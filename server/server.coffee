'use strict'
model = share.model # import

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
      incorrectAnswers: 1
      tags: 1
      drive: 1
      spreadsheet: 1
      doc: 1
      favorites: $elemMatch: $eq: @userId
      puzzles: 1
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

# Login not required for this because it's needed for nick autocomplete.
Meteor.publish 'all-nicks', ->
  Meteor.users.find {}, fields:
    priv_located: 0
    priv_located_at: 0
    priv_located_order: 0
    services: 0
Meteor.publish 'all-presence', loginRequired ->
  # strip out unnecessary fields from presence (esp timestamp) to avoid wasted
  # updates to clients
  model.Presence.find {present: true}, fields:
    timestamp: 0
    foreground_uuid: 0
    present: 0
Meteor.publish 'presence-for-room', loginRequired (room_name) ->
  model.Presence.find {present: true, room_name: room_name}, fields:
    timestamp: 0
    foreground_uuid: 0
    present: 0

Meteor.publish 'settings', loginRequired -> model.Settings.find()

Meteor.publish 'lastread', loginRequired -> model.LastRead.find nick: @userId

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
Meteor.publish 'metas-for-puzzle', loginRequired (id) -> @puzzleQuery puzzles: id
Meteor.publish 'round-by-id', loginRequired (id) -> model.Rounds.find _id: id
Meteor.publish 'round-for-puzzle', loginRequired (id) -> model.Rounds.find puzzles: id
Meteor.publish 'puzzles-by-meta', loginRequired (id) -> @puzzleQuery feedsInto: id

# get recent messages
Meteor.publish 'recent-messages', loginRequired (room_name, limit) ->
  model.Messages.find
    room_name: room_name
    $or: [ {to: null}, {to: @userId}, {nick: @userId }]
  ,
    sort: [['timestamp', 'desc']]
    limit: limit

# Special subscription for the recent chats header because it ignores system
# and presence messages and anything with an HTML body.
Meteor.publish 'recent-header-messages', loginRequired ->
  model.Messages.find
    room_name: 'general/0'
    system: $ne: true
    bodyIsHtml: $ne: true
    $or: [ {to: null}, {to: @userId}, {nick: @userId }]
  ,
    sort: [['timestamp', 'desc']]
    limit: 2

# Special subscription for desktop notifications
Meteor.publish 'oplogs-since', loginRequired (since) ->
  model.Messages.find
    room_name: 'oplog/0'
    timestamp: $gt: since

Meteor.publish 'starred-messages', loginRequired (room_name) ->
  model.Messages.find { room_name: room_name, starred: true },
    sort: [["timestamp", "asc"]]

Meteor.publish 'callins', loginRequired ->
  model.CallIns.find {},
    sort: [["created","asc"]]

Meteor.publish 'quips', loginRequired ->
  model.Quips.find {},
    sort: [["last_used","asc"]]

# synthetic 'all-names' collection which maps ids to type/name/canon
Meteor.publish 'all-names', loginRequired ->
  self = this
  handles = [ 'rounds', 'puzzles', 'quips' ].map (type) ->
    model.collection(type).find({}).observe
      added: (doc) ->
        self.added 'names', doc._id,
          type: type
          name: doc.name
          canon: model.canonical(doc.name)
      removed: (doc) ->
        self.removed 'names', doc._id
      changed: (doc,olddoc) ->
        return unless doc.name isnt olddoc.name
        self.changed 'names', doc._id,
          name: doc.name
          canon: model.canonical(doc.name)
  # observe only returns after initial added callbacks have run.  So now
  # mark the subscription as ready
  self.ready()
  # stop observing the various cursors when client unsubs
  self.onStop ->
    handles.map (h) -> h.stop()

Meteor.publish 'poll', loginRequired (id) ->
  model.Polls.find _id: id

## Publish the 'facts' collection to all users
#Facts.setUserIdFilter -> true
