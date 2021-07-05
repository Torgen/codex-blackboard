'use strict'
model = share.model # import
import canonical from '/lib/imports/canonical.coffee'
import { Settings } from '/lib/imports/settings.coffee'
import { NonEmptyString } from '/lib/imports/match.coffee'

DEBUG = !Meteor.isProduction

puzzleQuery = (query) -> 
  model.Puzzles.find query,
    fields:
      name: 1
      canon: 1
      link: 1
      created: 1
      created_by: 1
      touched: 1
      touched_by: 1
      solved: 1
      solved_by: 1
      tags: 1
      drive: 1
      spreadsheet: 1
      doc: 1
      "favorites.#{@userId}": 1
      mechanics: 1
      puzzles: 1
      order_by: 1
      feedsInto: 1

loginRequired = (f) -> ->
  return @ready() unless @userId
  @puzzleQuery = puzzleQuery
  f.apply @, arguments

# hack! log subscriptions so we can see what's going on server-side
Meteor.publish = ((publish) ->
  (name, func) ->
    func2 = ->
      console.log 'client subscribed to', name, arguments
      func.apply(this, arguments)
    publish.call(Meteor, name, func2)
)(Meteor.publish) if false # disable by default

Meteor.publish 'all-roundsandpuzzles', loginRequired -> [
  model.Rounds.find(), @puzzleQuery({})
]

Meteor.publish 'solved-puzzle-time', loginRequired -> model.Puzzles.find
  solved: $exists: true
,
  fields: solverTime: 1

# Login not required for this because it's needed for nick autocomplete.
Meteor.publish null, ->
  Meteor.users.find {}, fields:
    priv_located: 0
    priv_located_at: 0
    priv_located_order: 0
    services: 0
    favorite_mechanics: 0

# Login required for this since it returns you.
Meteor.publish null, loginRequired ->
  Meteor.users.find @userId, fields:
    services: 0
    priv_located_order: 0

Meteor.publish 'all-presence', loginRequired ->
  # strip out unnecessary fields from presence to avoid wasted updates to clients
  model.Presence.find {}, fields:
    timestamp: 0
    clients: 0
Meteor.publish 'presence-for-room', loginRequired (room_name) ->
  model.Presence.find {room_name, scope: 'chat'}, fields:
    timestamp: 0
    clients: 0

Meteor.publish 'register-presence', loginRequired (room_name, scope) ->
  check room_name, NonEmptyString
  check scope, NonEmptyString
  subscription_id = Random.id()
  console.log "#{@userId} subscribing to #{scope}:#{room_name} at #{model.UTCNow()}, id #{@connection.id}:#{subscription_id}" if DEBUG
  keepalive = =>
    now = model.UTCNow()
    model.Presence.upsert {nick: @userId, room_name, scope},
      $setOnInsert:
        joined_timestamp: now
      $max: timestamp: now
      $push: clients:
        connection_id: @connection.id
        subscription_id: subscription_id
        timestamp: now
    model.Presence.update {nick: @userId, room_name, scope},
      $pull: clients:
        connection_id: @connection.id
        subscription_id: subscription_id
        timestamp: $lt: now
  keepalive()
  interval = Meteor.setInterval keepalive, (model.PRESENCE_KEEPALIVE_MINUTES*60*1000)
  @onStop =>
    console.log "#{@userId} unsubscribing from #{scope}:#{room_name}, id #{@connection.id}:#{subscription_id}" if DEBUG
    Meteor.clearInterval interval
    now = model.UTCNow()
    Meteor.setTimeout =>
      model.Presence.update {nick: @userId, room_name, scope},
        $max: timestamp: now
        $pull: clients:
          connection_id: @connection.id
          subscription_id: subscription_id
    , 2000
  @ready()

Meteor.publish 'settings', loginRequired -> Settings.find()

Meteor.publish 'lastread', loginRequired (room_name) -> model.LastRead.find {nick: @userId, room_name}

# this is for the "that was easy" sound effect
# everyone is subscribed to this all the time
Meteor.publish 'last-answered-puzzle', loginRequired ->
  collection = 'last-answer'
  self = this
  uuid = Random.id()

  recent = null
  initializing = true

  max = (doc) ->
    if doc.solved?
      if (not recent?.target) or (doc.solved > recent.solved)
        recent = {solved:doc.solved, target:doc._id}
        return true
    return false

  publishIfMax = (doc) ->
    return unless max(doc)
    self.changed collection, uuid, recent \
      unless initializing
  publishNone = ->
    recent = {solved: model.UTCNow()} # "no recent solved puzzle"
    self.changed collection, uuid, recent \
      unless initializing

  handle = model.Puzzles.find(
    solved: $ne: null
  ).observe
    added: (doc) -> publishIfMax(doc)
    changed: (doc, oldDoc) -> publishIfMax(doc)
    removed: (doc) ->
      publishNone() if doc._id is recent?.target

  # observe only returns after initial added callbacks.
  # if we still don't have a 'recent' (possibly because no puzzles have
  # been answered), set it to current time
  publishNone() unless recent?
  # okay, mark the subscription as ready.
  initializing = false
  self.added collection, uuid, recent
  self.ready()
  # Stop observing the cursor when client unsubs.
  # Stopping a subscription automatically takes care of sending the
  # client any 'removed' messages
  self.onStop -> handle.stop()

# limit site traffic by only pushing out changes relevant to a certain
# round or puzzle
Meteor.publish 'puzzle-by-id', loginRequired (id) -> @puzzleQuery _id: id
Meteor.publish 'callins-by-puzzle', loginRequired (id) -> model.CallIns.find {target_type: 'puzzles', target: id}
Meteor.publish 'metas-for-puzzle', loginRequired (id) -> @puzzleQuery puzzles: id
Meteor.publish 'round-by-id', loginRequired (id) -> model.Rounds.find _id: id
Meteor.publish 'round-for-puzzle', loginRequired (id) -> model.Rounds.find puzzles: id
Meteor.publish 'puzzles-by-meta', loginRequired (id) -> @puzzleQuery feedsInto: id

# get recent messages
Meteor.publish 'recent-messages', loginRequired (room_name, limit) ->
  model.Messages.find
    room_name: room_name
    $or: [ {to: null}, {to: @userId}, {nick: @userId }]
    deleted: $ne: true
  ,
    sort: [['timestamp', 'desc']]
    limit: limit

# Special subscription for the recent chats header because it ignores system
# and presence messages and anything with an HTML body.
Meteor.publish 'recent-header-messages', loginRequired ->
  model.Messages.find
    system: $ne: true
    bodyIsHtml: $ne: true
    deleted: $ne: true
    header_ignore: $ne: true
    $or: [ {room_name: 'general/0', to: null}, {to: @userId}, {room_name: 'general/0', nick: @userId }]
  ,
    sort: [['timestamp', 'desc']]
    limit: 2

# Special subscription for desktop notifications
Meteor.publish 'oplogs-since', loginRequired (since) ->
  model.Messages.find
    room_name: 'oplog/0'
    timestamp: $gt: since

Meteor.publish 'starred-messages', loginRequired (room_name) ->
  model.Messages.find { room_name: room_name, starred: true, deleted: { $ne: true } },
    sort: [["timestamp", "asc"]]

Meteor.publish 'callins', loginRequired ->
  model.CallIns.find {status: $in: ['pending', 'rejected']},
    sort: [["created","asc"]]

Meteor.publish 'quips', loginRequired ->
  model.Quips.find {},
    sort: [["last_used","asc"]]

# synthetic 'all-names' collection which maps ids to type/name/canon
Meteor.publish null, loginRequired ->
  self = this
  handles = [ 'rounds', 'puzzles', 'quips' ].map (type) ->
    model.collection(type).find({}).observe
      added: (doc) ->
        self.added 'names', doc._id,
          type: type
          name: doc.name
          canon: canonical doc.name
      removed: (doc) ->
        self.removed 'names', doc._id
      changed: (doc,olddoc) ->
        return unless doc.name isnt olddoc.name
        self.changed 'names', doc._id,
          name: doc.name
          canon: canonical doc.name
  # observe only returns after initial added callbacks have run.  So now
  # mark the subscription as ready
  self.ready()
  # stop observing the various cursors when client unsubs
  self.onStop ->
    handles.map (h) -> h.stop()

Meteor.publish 'poll', loginRequired (id) ->
  model.Polls.find _id: id

## Publish the 'facts' collection to all users
Facts.setUserIdFilter -> true
