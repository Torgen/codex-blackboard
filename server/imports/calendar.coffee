'use strict'

import { ROOT_FOLDER_NAME, CODEX_ACCOUNT, SHARE_GROUP } from '/server/imports/googlecommon.coffee'

# Cambridge is on Eastern time.
CALENDAR_TIME_ZONE = Meteor.settings.calendar?.time_zone or process.env.CALENDAR_TIME_ZONE or 'America/New_York'

# TODO: make configurable?
POLL_INTERVAL = 30000

export class CalendarSync
  constructor: (@api) ->
    cal = share.model.Calendar.findOne()
    do =>
      if cal?
        @id = cal._id
        @syncToken = cal.syncToken
        console.log "Using existing calendar #{@id}"
        return

      @syncToken = null
        
      @id = Promise.await do =>
        # See if one exists
        pageToken = null
        loop
          res = (await @api.calendarList.list {pageToken}).data
          for item in res.items
            if item.summary is ROOT_FOLDER_NAME()
              console.log "Found calendar #{item.id}"
              return item.id
          break unless (pageToken = res.nextPageToken)
        # Apparently not, so make one.
        cal = (await @api.calendars.insert requestBody:
          summary: ROOT_FOLDER_NAME()
          timeZone: CALENDAR_TIME_ZONE
        ).data
        console.log "Made calendar #{cal.id}"
        return cal.id
      
      share.model.Calendar.insert { _id: @id }

    promises = [@_pollAndReschedule()]
    acls = Promise.await @api.acl.list({calendarId: @id, maxResults: 250})
    unless acls.data.items.some (x) -> x.role is 'reader' and x.scope.type is 'default'
      # Ensure public. (default can't be writer.)
      promises.push @api.acl.insert
        calendarId: @id
        requestBody:
          role: 'reader'
          scope:
            type: 'default'
    writer = SHARE_GROUP()
    if writer?
      unless acls.data.items.some (x) -> x.role is 'writer' and x.scope.type is 'group' and x.scope.value is writer
        # Make codex account an owner
        promises.push @api.acl.insert
          calendarId: @id
          requestBody:
            role: 'writer'
            scope:
              type: 'group'
              value: writer
    owner = CODEX_ACCOUNT()
    if owner?
      unless acls.data.items.some (x) -> x.role is 'owner' and x.scope.type is 'user' and x.scope.value is owner
        # Make codex account an owner
        promises.push @api.acl.insert
          calendarId: @id
          requestBody:
            role: 'owner'
            scope:
              type: 'user'
              value: owner
    Promise.await Promise.all promises

  pollOnce: ->
    pageToken = null
    bulkEventUpdates = []
    loop
      events = null
      try
        events = (await @api.events.list
          calendarId: @id
          pageToken: pageToken
          syncToken: (if pageToken? then null else @syncToken)
        ).data
      catch e
        if e.code is 410 and @syncToken?
          @syncToken = null
          continue
        throw e
      for event in events.items
        if event.status is 'cancelled'
          bulkEventUpdates.push
            deleteOne: filter: _id: event.id
        else
          update = {}
          set = {}
          unset = {}
          if event.end?.dateTime?
            set.end = Date.parse event.end?.dateTime
            update.$set = set
          if event.start?.dateTime?
            set.start = Date.parse event.start?.dateTime
            update.$set = set
          setUnset = (eventKey, documentKey) ->
            if event[eventKey]?
              set[documentKey] = event[eventKey]
              update.$set = set
            else
              unset[documentKey] = ''
              update.$unset = unset
          setUnset 'summary', 'summary'
          setUnset 'location', 'location'
          setUnset 'description', 'description'
          setUnset 'htmlLink', 'link'
          bulkEventUpdates.push
            updateOne:
              filter: _id: event.id
              upsert: true
              update: update
      if events.nextPageToken?
        pageToken = events.nextPageToken
      else
        @syncToken = events.nextSyncToken
        break
    bulkUpdates = if bulkEventUpdates.length
      share.model.CalendarEvents.rawCollection().bulkWrite bulkEventUpdates, ordered: false
    else Promise.resolve()
    updateSync = share.model.Calendar.rawCollection().update {_id: @id},
      $set: syncToken: @syncToken
    await Promise.all [bulkUpdates, updateSync]

  _pollAndReschedule: ->
    try
      await @pollOnce()
    catch e
      console.warn e
    @_schedulePoll()

  _schedulePoll: (interval = POLL_INTERVAL) ->
    @stop()
    @timeoutHandle = Meteor.setTimeout (=> @_pollAndReschedule()), interval

  stop: ->
    Meteor.clearTimeout @timeoutHandle if @timeoutHandle?
    
