'use strict'
import canonical from '/lib/imports/canonical.coffee'
import { PRESENCE_KEEPALIVE_MINUTES } from '/lib/imports/constants.coffee'
import { Calendar, CalendarEvents, CallIns, LastRead, Messages, Polls, Presence, Puzzles, Roles, Rounds, collection } from '/lib/imports/collections.coffee'
import { Settings } from '/lib/imports/settings.coffee'
import { NonEmptyString } from '/lib/imports/match.coffee'

DEBUG = !Meteor.isProduction

puzzleQuery = (query) -> 
  Puzzles.find query,
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
      drive_touched: 1
      drive_status: 1
      drive_error_message: 1
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
  Rounds.find(), @puzzleQuery({})
]

Meteor.publish 'solved-puzzle-time', loginRequired -> Puzzles.find
  solved: $exists: true
,
  fields: solverTime: 1

# Login not required for this because it's needed for nick autocomplete.
Meteor.publish null, ->
  Meteor.users.find {}, fields:
    priv_located: 0
    priv_located_at: 0
    priv_located_order: 0
    located: 0
    located_at: 0
    services: 0
    favorite_mechanics: 0

# Login required for this since it returns you.
Meteor.publish null, loginRequired ->
  Meteor.users.find @userId, fields:
    services: 0
    priv_located_order: 0

# Login required for this since it includes location
Meteor.publish null, loginRequired ->
  Meteor.users.find {}, fields:
    located: 1
    located_at: 1

Meteor.publish null, loginRequired ->
  handle = Presence.find({room_name: null, scope: 'online'}, {nick: 1}).observe
    added: ({nick}) =>
      @added 'users', nick, {online: true}
    removed: ({nick}) =>
      @removed 'users', nick
  @onStop -> handle.stop()
  @ready()

# Private messages to you
Meteor.publish null, loginRequired -> Messages.find {to: @userId, deleted: $ne: true}
# Messages that mention you
Meteor.publish null, loginRequired -> Messages.find {mention: @userId, deleted: $ne: true}

# Calendar events
Meteor.publish null, loginRequired -> [
  Calendar.find({}, {fields: _id: 1}),
  CalendarEvents.find()]

Meteor.publish 'announcements-since', loginRequired (since) -> Messages.find
  announced_at: $gt: since
  deleted: $ne: true

# Roles
Meteor.publish null, loginRequired ->
  Roles.find({}, {fields: {holder: 1, claimed_at: 1}})

Meteor.publish null, loginRequired ->
  Roles.find({holder: @userId}, {fields: {renewed_at: 1, expires_at: 1}})

# Share one map among all listeners
do ->
  handles = new Set
  holders = new Map
  addHolder = (role, holder) ->
    held = holders.get holder
    if held?
      held.add role
      for h from handles
        h.changed 'users', holder, {"roles": [...held]}
    else
      held = new Set [role]
      holders.set holder, held
      for h from handles
        h.added 'users', holder, {"roles": [...held]}
  removeHolder = (role, holder) ->
    held = holders.get holder
    held.delete role
    if held.size is 0
      holders.delete holder
      for h from handles
        h.removed 'users', holder
    else
      for h from handles
        h.changed 'users', holder, {"roles": [...held]}

  handle = Roles.find({}, {fields: holder: 1}).observe
    added: ({_id, holder}) -> addHolder _id, holder
    changed: ({_id, holder: newHolder}, {holder: oldHolder}) ->
      removeHolder _id, oldHolder
      addHolder _id, newHolder
    removed: ({_id, holder}) -> removeHolder _id, holder
  
  Meteor.publish null, loginRequired ->
    handles.add @
    for [holder, roles] from holders.entries()
      @added 'users', holder, {roles: [...roles]}
    @onStop ->
      handles.delete @
    @ready()

# Your presence in all rooms, with _id changed to room_name.
Meteor.publish null, loginRequired ->
  idToRoom = new Map
  handle = LastRead.find({nick: @userId}).observeChanges
    added: (id, fields) =>
      idToRoom.set id, fields.room_name
      @added 'lastread', fields.room_name, fields
    changed: (id, {timestamp}) =>
      return unless timestamp?
      # There's no way to change the room name or nick of an existing lastread entry.
      @changed 'lastread', idToRoom.get(id), {timestamp}
  @onStop -> handle.stop()
  @ready()

Meteor.publish 'all-presence', loginRequired ->
  # strip out unnecessary fields from presence to avoid wasted updates to clients
  Presence.find {room_name: $ne: null}, fields:
    timestamp: 0
    clients: 0
Meteor.publish 'presence-for-room', loginRequired (room_name) ->
  Presence.find {room_name, scope: 'chat'}, fields:
    timestamp: 0
    clients: 0

registerPresence = (room_name, scope) ->
  subscription_id = Random.id()
  console.log "#{@userId} subscribing to #{scope}:#{room_name} at #{Date.now()}, id #{@connection.id}:#{subscription_id}" if DEBUG
  keepalive = =>
    now = Date.now()
    Presence.upsert {nick: @userId, room_name, scope},
      $setOnInsert:
        joined_timestamp: now
      $max: timestamp: now
      $push: clients:
        connection_id: @connection.id
        subscription_id: subscription_id
        timestamp: now
    Presence.update {nick: @userId, room_name, scope},
      $pull: clients:
        connection_id: @connection.id
        subscription_id: subscription_id
        timestamp: $lt: now
  keepalive()
  interval = Meteor.setInterval keepalive, (PRESENCE_KEEPALIVE_MINUTES*60*1000)
  @onStop =>
    console.log "#{@userId} unsubscribing from #{scope}:#{room_name}, id #{@connection.id}:#{subscription_id}" if DEBUG
    Meteor.clearInterval interval
    now = Date.now()
    Meteor.setTimeout =>
      Presence.update {nick: @userId, room_name, scope},
        $max: timestamp: now
        $pull: clients:
          connection_id: @connection.id
          subscription_id: subscription_id
    , 2000
  @ready()

Meteor.publish 'register-presence', loginRequired (room_name, scope) ->
  check room_name, NonEmptyString
  check scope, NonEmptyString
  registerPresence.call @, room_name, scope
Meteor.publish null, loginRequired ->
  registerPresence.call @, null, 'online'

Meteor.publish null, loginRequired -> Settings.find()

Meteor.publish 'last-puzzle-room-message', loginRequired (puzzle_id) ->
  check puzzle_id, NonEmptyString
  @added 'puzzles', puzzle_id, {}
  lastChat = Messages.find 
    room_name: "puzzles/#{puzzle_id}"
    $or: [ {to: null}, {to: @userId}, {nick: @userId }]
    deleted: $ne: true
    presence: null
  ,
    fields: timestamp: 1
    sort: timestamp: -1
    limit: 1
  .observe
    added: (doc) => @changed 'puzzles', puzzle_id, {last_message_timestamp: doc.timestamp}
  lastReadCallback = (doc) => @changed 'puzzles', puzzle_id, {last_read_timestamp: doc.timestamp}
  lastRead = LastRead.find
    room_name: "puzzles/#{puzzle_id}"
    nick: @userId
  .observe
    added: (doc) -> lastReadCallback
    changed: (doc) -> lastReadCallback
  @onStop ->
    lastChat.stop()
    lastRead.stop()
  @ready()

# this is for the "that was easy" sound effect
# everyone is subscribed to this all the time
Meteor.publish 'last-answered-puzzle', loginRequired ->
  COLLECTION = 'last-answer'
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
    self.changed COLLECTION, uuid, recent \
      unless initializing
  publishNone = ->
    recent = {solved: Date.now()} # "no recent solved puzzle"
    self.changed COLLECTION, uuid, recent \
      unless initializing

  handle = Puzzles.find(
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
  self.added COLLECTION, uuid, recent
  self.ready()
  # Stop observing the cursor when client unsubs.
  # Stopping a subscription automatically takes care of sending the
  # client any 'removed' messages
  self.onStop -> handle.stop()

# limit site traffic by only pushing out changes relevant to a certain
# round or puzzle
Meteor.publish 'callins-by-puzzle', loginRequired (id) -> CallIns.find {target_type: 'puzzles', target: id}

# get recent messages
Meteor.publish 'recent-messages', loginRequired (room_name, limit) ->
  handle = Messages.find
    room_name: room_name
    $or: [ {to: null}, {to: @userId}, {nick: @userId }]
    deleted: $ne: true
  ,
    sort: [['timestamp', 'desc']]
    limit: limit
  .observeChanges
    added: (id, fields) =>
      @added 'messages', id, {fields..., from_chat_subscription: true}
    changed: (id, fields) =>
      @changed 'messages', id, fields
    removed: (id) =>
      @removed 'messages', id
  @onStop -> handle.stop()
  @ready()

# Special subscription for the recent chats header because it ignores system
# and presence messages and anything with an HTML body.
Meteor.publish 'recent-header-messages', loginRequired ->
  Messages.find
    system: $ne: true
    bodyIsHtml: $ne: true
    deleted: $ne: true
    header_ignore: $ne: true
    room_name: 'general/0'
    $or: [ {to: null},  {nick: @userId }]
  ,
    sort: [['timestamp', 'desc']]
    limit: 2

# Special subscription for desktop notifications
Meteor.publish 'oplogs-since', loginRequired (since) ->
  Messages.find
    room_name: 'oplog/0'
    timestamp: $gt: since

Meteor.publish 'starred-messages', loginRequired (room_name) ->
  Messages.find { room_name: room_name, starred: true, deleted: { $ne: true } },
    sort: [["timestamp", "asc"]]

Meteor.publish 'callins', loginRequired ->
  CallIns.find {status: $in: ['pending', 'rejected']},
    sort: [["created","asc"]]

# synthetic 'all-names' collection which maps ids to type/name/canon
Meteor.publish null, loginRequired ->
  self = this
  handles = [ 'rounds', 'puzzles' ].map (type) ->
    collection(type).find({}).observe
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
  Polls.find _id: id

## Publish the 'facts' collection to all users
Facts.setUserIdFilter -> true
