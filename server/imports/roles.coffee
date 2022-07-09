import { callAs } from '/server/imports/impersonate.coffee'

export class RoleManager

  start: ->
    release = =>
      [holder, @holder, @timeout] = [@holder, null, null]
      callAs 'releaseOnduty', holder

    enqueue = (expires_at) =>
      now = share.model.UTCNow()
      if expires_at <= now
        release()
      else
        @timeout = Meteor.setTimeout release, (expires_at - now)

    @handle = share.model.Roles.find({_id: 'onduty'}, {fields: {holder: 1, expires_at: 1}}).observeChanges
      added: (role, {holder, expires_at}) =>
        @holder = holder
        now = share.model.UTCNow()
        enqueue(expires_at)

      changed: (role, {holder, expires_at}) =>
        if holder?
          @holder = holder
        if expires_at?
          Meteor.clearTimeout @timeout
          enqueue(expires_at)

      removed: (role) =>
        if @timeout?
          Meteor.clearTimeout @timeout
          @timeout = null
          @holder = null

  stop: ->
    if @timeout?
      Meteor.clearTimeout @timeout
      @timeout = null
    @handle.stop()

