'use strict'

model = share.model

startPageTokens = new Mongo.Collection('start_page_tokens');
startPageTokens.createIndex(({timestamp: 1}));

POLL_INTERVAL = 60000

CHANGES_FIELDS = "nextPageToken,newStartPageToken,changes(changeType,fileId,file(name,mimeType,parents,createdTime,modifiedTime,webViewLink))"

export default class DriveChangeWatcher
  constructor: (@driveApi, @rootDir) ->
    lastToken = startPageTokens.findOne {}, {limit: 1, sort: timestamp: -1}
    unless lastToken
      {data: {startPageToken}} = Promise.await @driveApi.changes.getStartPageToken()
      lastToken =
        timestamp: model.UTCNow()
        token: startPageToken
      startPageTokens.insert lastToken
    @startPageToken = lastToken.token
    @lastPoll = lastToken.timestamp
    @timeoutHandle = Meteor.setTimeout (=> @poll()), Math.max(0, lastToken.timestamp + POLL_INTERVAL - model.UTCNow())

  poll: ->
    token = @startPageToken
    pollStart = model.UTCNow()
    try
      loop
        {data} = Promise.await @driveApi.changes.list
          pageToken: token
          pageSize: 1000
          fields: CHANGES_FIELDS
        console.log "got #{data.changes.length} changes:"
        updates = new Map()  # key: puzzle id, value: max modifiedTime of file with it as parent
        created = new Map()  # key: file ID, value: {name, mimeType, webViewLink, channel}
        promises = data.changes.map (changeType, fileId, file: {name, mimeType, parents, createdTime, modifiedTime, webViewLink}) =>
          return unless changeType is 'file'
          moddedAt = Date.parse modifiedTime
          createdAt = Date.parse createdTime
          channel = null
          puzzleId = null
          if parents.includes @rootDir
            channel = 'general/0'
          else
            puzzle = await model.Puzzles.rawCollection().findOne {drive: $in: parents}
            return unless puzzle?
            # don't tell everyone about the automatic files.
            return if puzzle.spreadsheet is fileId or puzzle.doc is fileId
            puzzleId = puzzle._id
            channel = "puzzles/#{puzzleId}"
          if puzzleId? and moddedAt > pollStart
            updates.set(puzzlesId, moddedAt) unless updates.get(puzzleId) > moddedAt
          if createdAt > pollStart and not created.has fileId
            created.set fileId, {name, mimeType, webViewLink, channel}
        if data.nextPageToken?
          token = data.nextPageToken
        else if data.newStartPageToken?
          Promise.await Promise.all promises
          updates.forEach (timestamp, puzzle) =>
            console.log "Update #{puzzle} with new timestamp #{timestamp}"
          createdAt.forEach ({name, mimeType, webViewLink, channel}, fileId) =>
            console.log "Tell #{channel} about #{name}, a #{mimeType} at #{webViewLink}"
          # TODO: make relevant database changes
          @lastPoll = pollStart
          @startPageToken = data.newStartPageToken
          startPageTokens.upsert {},
            $set:
              timestamp: pollStart
              token: data.newStartPageToken
          , {multi: false, sort: timestamp: 1}
          break
    catch e
      console.error e
    @timeoutHandle = Meteor.setTimeout (=> @poll()), POLL_INTERVAL

  stop: ->
    Meteor.clearTimeout @timeoutHandle
