'use strict'
model = share.model # import

loginRequired = (f) -> ->
  return @ready() unless @userId
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
  model.RoundGroups.find(), model.Rounds.find(), model.Puzzles.find()
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

Meteor.publish 'lastread', loginRequired -> model.LastRead.find nick: @userId

# this is for the "that was easy" sound effect
# everyone is subscribed to this all the time
Meteor.publish 'last-answered-puzzle', loginRequired ->
  collection = 'last-answer'
  self = this
  uuid = Random.id()

  recent = null
  initializing = true

  max = (type, doc) ->
    if doc.solved?
      if (not recent?.target) or (doc.solved > recent.solved)
        recent = {solved:doc.solved, type:type, target:doc._id}
        return true
    return false

  publishIfMax = (type, doc) ->
    return unless max(type, doc)
    self.changed collection, uuid, recent \
      unless initializing
  publishNone = ->
    recent = {solved: model.UTCNow()} # "no recent solved puzzle"
    self.changed collection, uuid, recent \
      unless initializing

  # XXX this observe polls on 0.7.0.1
  # (but not on the meteor oplog-with-operators branch)
  handles = [
    "puzzles", "rounds", "roundgroups"
  ].map (type) -> model.collection(type).find({
    solved: { $exists: true, $ne: null }
  }).observe
    added: (doc) -> publishIfMax(type, doc)
    changed: (doc, oldDoc) -> publishIfMax(type, doc)
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
  self.onStop -> (handle.stop() for handle in handles)

# limit site traffic by only pushing out changes relevant to a certain
# roundgroup, round, or puzzle
Meteor.publish 'puzzle-by-id', loginRequired (id) -> model.Puzzles.find _id: id
Meteor.publish 'round-by-id', loginRequired (id) -> model.Rounds.find _id: id
Meteor.publish 'round-for-puzzle', loginRequired (id) -> model.Rounds.find puzzles: id
Meteor.publish 'roundgroup-for-round', loginRequired (id) -> model.RoundGroups.find rounds: id

# get recent messages

# the last Page object for every room_name.
Meteor.publish 'last-pages', loginRequired -> model.Pages.find(next: null)
# a specific page object
Meteor.publish 'page-by-id', loginRequired (id) -> model.Pages.find _id: id
Meteor.publish 'page-by-timestamp', loginRequired (room_name, timestamp) ->
  model.Pages.find room_name: room_name, to: timestamp

for messages in [ 'messages', 'oldmessages' ]
  do (messages) ->
    # paged messages.  client is responsible for giving a reasonable
    # range, which is a bit of an issue.  Once limit is supported in oplog
    # we could probably add a limit here to be a little safer.
    Meteor.publish "#{messages}-in-range", loginRequired (room_name, from, to=0) ->
      # XXX this observe polls on 0.7.0.1
      # (but not on the meteor oplog-with-operators branch)
      cond = $gte: +from, $lt: +to
      delete cond.$lt if cond.$lt is 0
      model.collection(messages).find
        room_name: room_name
        timestamp: cond
        to: null # no pms

    # same thing, but nick-specific.  This allows us to share the big query;
    # paged-messages-nick should be small/light-weight.
    Meteor.publish "#{messages}-in-range-to-me", loginRequired (room_name, from, to=0) ->
      cond = $gte: +from, $lt: +to
      delete cond.$lt if cond.$lt is 0
      model.collection(messages).find
        room_name: room_name
        timestamp: cond
        $or: [ { nick: @userId }, { to: @userId } ]

Meteor.publish 'starred-messages', loginRequired (room_name) ->
  for messages in [ model.OldMessages, model.Messages ]
    messages.find { room_name: room_name, starred: true },
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
  handles = [ 'roundgroups', 'rounds', 'puzzles', 'quips' ].map (type) ->
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

## Publish the 'facts' collection to all users
#Facts.setUserIdFilter -> true
