'use strict'

model = share.model

startPageTokens = new Mongo.Collection('start_page_tokens');
startPageTokens.createIndex(({timestamp: 1}));

POLL_INTERVAL = 60000

export default class DriveChangeWatcher
  constructor: (@driveApi, @rootDir) ->
    lastToken = startPageTokens.findOne {}, {limit: 1, sort: timestamp: -1}
    unless lastToken
      {data: {startPageToken}} = Promise.await @driveApi.changes.startPageToken()
      lastToken =
        timestamp: model.UTCNow()
        token: startPageToken
      startPageTokens.insert lastToken
    @startPageToken = lastToken.token
    @timeoutHandle = Meteor.setTimeout (=> @poll()), Math.max(0, lastToken.timestamp + POLL_INTERVAL - model.UTCNow())

  poll: ->
    token = @startPageToken
    try
      loop
        {data} = Promise.await @driveApi.changes.list
          pageToken: token
          pageSize: 1000
        # TODO: do something with changes
        console.log "got #{data.changes.length} changes:"
        for change in data.changes
          console.log change
        if data.nextPageToken?
          token = data.nextPageToken
        else if data.newStartPageToken?
          # TODO: commit results
          @startPageToken = data.newStartPageToken
          startPageTokens.upsert {},
            $set:
              timestamp. model.UTCNow()
              token: data.newStartPageToken
          , {sort: timestamp: 1}
          break
    catch e
      console.error e
    @timeoutHandle = Meteor.setTimeout (=> @poll()), POLL_INTERVAL

  stop: ->
    Meteor.clearTimeout @timeoutHandle
