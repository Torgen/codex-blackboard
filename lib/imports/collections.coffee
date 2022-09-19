'use strict'

export BBCollection = Object.create(null) # create new object w/o any inherited cruft

# Names is a synthetic collection created by the server which indexes
# the names and ids of Rounds and Puzzles:
#   _id: mongodb id (of a element in Rounds or Puzzles)
#   type: string ("rounds", "puzzles")
#   name: string
#   canon: canonicalized version of name, for searching
export Names = BBCollection.names = \
  if Meteor.isClient then new Mongo.Collection 'names' else null

# LastAnswer is a synthetic collection created by the server which gives the
# solution time of the most recently-solved puzzle.
#    _id: random UUID
#    solved: solution time
#    type: string ("puzzles" or "rounds")
#    target: id of most recently solved puzzle/round
export LastAnswer = BBCollection.last_answer = \
  if Meteor.isClient then new Mongo.Collection 'last-answer' else null

# Rounds are:
#   _id: mongodb id
#   name: string
#   canon: canonicalized version of name, for searching
#   link: URL of the round on the hunt site
#   created: timestamp
#   created_by: canon of Nick
#   sort_key: timestamp. Initially created, but can be traded to other rounds.
#   touched: timestamp -- records edits to tag, order, group, etc.
#   touched_by: canon of Nick with last touch
#   tags: status: { name: "Status", value: "stuck" }, ... 
#   puzzles: [ array of puzzle _ids, in order ]
#            Preserving order is why this is a list here and not a foreign key
#            in the puzzle.
export Rounds = BBCollection.rounds = new Mongo.Collection "rounds"
if Meteor.isServer
  Rounds.createIndex {canon: 1}, {unique:true, dropDups:true}
  Rounds.createIndex {puzzles: 1}
  Rounds.createIndex {sort_key: 1}
  Rounds.createIndex {sort_key: -1}

# Puzzles are:
#   _id: mongodb id
#   name: string
#   canon: canonicalized version of name, for searching
#   link: URL of the puzzle on the hunt site
#   created: timestamp
#   created_by: canon of Nick
#   touched: timestamp
#   touched_by: canon of Nick with last touch
#   solved:  timestamp -- null (not missing or zero) if not solved
#            (actual answer is in a tag w/ name "Answer")
#   solved_by:  timestamp of Nick who confirmed the answer
#   solverTime: aggregate milliseconds spent in chat while not solved.
#               Derived from chat presence, so more frequent checkins give
#               higher accuracy.
#   tags: status: { name: "Status", value: "stuck" }, ... 
#   drive: optional google drive folder id
#   spreadsheet: optional google spreadsheet id
#   doc: optional google doc id
#   drive_touched: Time of last change to a file in the drive folder
#   drive_status: optional string.
#     'failed' means an exception happened in drive creation, and an error
#       will be in drive_error_message.
#     'creating' means the puzzle has been created, but not the drive folder
#     'fixing' means the 'fixPuzzleFolder' method is being called
#     'skipped' means there is no drive API
#     null means the drive folder should have been created
#   drive_error_message: exception type and message if drive folder creation failed.
#   favorites: object whose keys are userids of users who favorited this
#              puzzle. Values are true. On the client, either empty or contains
#              only you.
#   mechanics: list of canonical forms of mechanic names from
#              ./imports/mechanics.coffee.
#   puzzles: array of puzzle _ids for puzzles that feed into this.
#            absent if this isn't a meta. empty if it is, but nothing feeds into
#            it yet.
#   order_by: If this is a meta, how to sort puzzles in it.
#     If unset/empty, use the order in the puzzles array.
#     If 'name', alphabetically by name
#   feedsInto: array of puzzle ids for metapuzzles this feeds into. Can be empty.
#     if a has b in its feedsInto, then b should have a in its puzzles.
#     This is kept denormalized because the lack of indexes in Minimongo would
#     make it inefficient to query on the client, and because we want to control
#     the order within a meta.
#     Note that this allows arbitrarily many meta puzzles. Also, there is no
#     requirement that a meta be fed only by puzzles in the same round.
#   last_message_timestamp: (synthetic, client only, optional) Timestamp of the
#     last non-presence chat message in this puzzle's channel visible to you.
#   last_read_timestamp: (synthetic, client only, optional) Your last read
#      timestamp in this puzzle's channel.
# If you add fields to this that should be visible on the client, also add them
# to the fields map in puzzleQuery in server/server.coffee.
export Puzzles = BBCollection.puzzles = new Mongo.Collection "puzzles"
if Meteor.isServer
  Puzzles.createIndex {canon: 1}, {unique:true, dropDups:true}
  Puzzles.createIndex {feedsInto: 1}
  Puzzles.createIndex {puzzles: 1}
  Puzzles.createIndex {solved: 1}, {partialFilterExpression: solved: $exists: true}
  Puzzles.createIndex {drive: 1}

# CallIns are:
#   _id: mongodb id
#   callin_type: type of callin.
#      Must be one of the constants from imports/callin_types.coffee.
#   target: _id of puzzle
#   target_type: type of target. Must be 'puzzles'.
#   answer: string (proposed answer to call in)
#   created: timestamp
#   created_by: canon of Nick
#   submitted_to_hq: true/false
#   submitted_by: canon of Nick
#   backsolve: true/false
#   provided: true/false
#   status: one of 'pending', 'accepted', 'rejected', or 'cancelled'.
#   resolved: (optional) timestamp when status became not pending.
#   response: (optional) response from HQ to this callin
export CallIns = BBCollection.callins = new Mongo.Collection "callins"
if Meteor.isServer
  CallIns.createIndex {status: 1, created: 1}
  CallIns.createIndex {status: 1, target_type: 1, target: 1, callin_type: 1, answer: 1}, {unique:true, dropDups:true, partialFilterExpression: {status: 'pending'}}
  CallIns.createIndex {target_type: 1, target: 1, created: 1}

# Polls are:
#   _id: mongodb id
#   created: timestamp of creation
#   created_by: userId of creator
#   question: "poll question"
#   options: list of {canon: "canonical text", option: "original text"}
#   votes: document where keys are canonical user names and values are {canon: "canonical text" timestamp: timestamp of vote}
export Polls = BBCollection.polls = new Mongo.Collection "polls"

# Users are:
#   _id: canonical nickname
#   located: timestamp
#   located_at: object with numeric lat/lng properties
#   priv_located, priv_located_at: these are the same as the
#     located/located_at properties, but they are updated more frequently.
#     The server throttles the updates from priv_located* to located* to
#     prevent a N^2 blowup as everyone gets updates from everyone else
#   priv_located_order: FIFO queue for location updates
#   nickname (non-canonical form of _id)
#   real_name (optional)
#   gravatar (optional email address for avatar)
#   services: map of provider-specific stuff; hidden on client
#   favorite_mechanics: list of favorite mechanics in canonical form.
#     Only served to yourself.
if Meteor.isServer
  Meteor.users.createIndex {priv_located_order: 1},
    partialFilterExpression:
      priv_located_order: { $exists: true }
  # We don't push the index to the client, so it's okay to have it update
  # frequently.
  Meteor.users.createIndex {priv_located_at: '2dsphere'}, {}

# Roles are:
#  _id: name of the role. Should be idempotent under canonical(). (e.g. onduty)
#  holder: userid of the current role holder
#  claimed_at: timestamp of when the holder claimed the role without interruption
#  renewed_at: timestamp of when the holder most recently renewed the role, either
#    by performing a role action or by explicitly renewing
#  expires_at: timestamp of when the holder must renew the role by. After this time,
#    the role entry may be deleted. This is likely a fixed time after renewed_at
#    based on a dynamic setting.
export Roles = BBCollection.roles = new Mongo.Collection 'roles'
if Meteor.isServer
  Roles.createIndex {holder: 1}, {}

# Messages
#   body: string
#   nick: canonicalized string (may match some Nicks.canon ... or not)
#   system: boolean (true for system messages, false for user messages)
#   action: boolean (true for /me commands)
#   oplog:  boolean (true for semi-automatic operation log message)
#   presence: optional string ('join'/'part' for presence-change only)
#   bot_ignore: optional boolean (true for messages from e.g. email or twitter)
#   header_ignore: optional boolean (don't show in header)
#   on_behalf: optional boolean. True for messages when the user didn't directly
#              call newMessage, but a message was created in their voice.
#              This excludes those messages from history when using up and down
#              arrows to repeat an old message.
#   to:   destination of pm (optional)
#   poll: _id of poll (optional)
#   starred: boolean. Pins this message to the top of the puzzle page or blackboard.
#   room_name: "<type>/<id>", ie "puzzle/1", "round/1".
#                             "general/0" for main chat.
#                             "oplog/0" for the operation log.
#   timestamp: timestamp
#   useful: boolean (true for useful responses from bots; not set for "fun"
#                    bot messages and commands that trigger them.)
#   useless_cmd: boolean (true if this message triggered the bot to
#                         make a not-useful response)
#   dawn_of_time: boolean. True for the first message in each channel, which
#                 also has _id equal to the channel name.
#   deleted: boolean. True if message was deleted. 'Deleted' messages aren't
#            actually deleted because that could screw up the 'last read' line;
#            they're just not rendered.
#   mention: optional array of user IDs mentioned in the message.
#   announced_at: timestamp a message was announced. (This is done to messages in
#                 main chat by starring them for the first time.)
#   announced_by: Who announced the message. Might not be the same as who said it.
#   from_chat_subscription: true if this message was returned by the recent messages
#       subscription. Allows rendering only the contiguous messages, without messages
#       from other subscriptions like personal private messages or starred messages
#       appearing out of context. (optional, synthetic, client only)
#   file_upload: embedded document. Present for system messages generated from files
#                being uploaded to drive folders. Nested keys:
#     fileId: The Google Drive ID of the file
#     webViewLink: A URL for viewing the file
#     name: the name of the file at the time of creation. (It may by changed.)
#     mimeType: the mime type of the file.
#
# Messages which are part of the operation log have `nick`, `message`,
# and `timestamp` set to describe what was done, when, and by who.
# They have `system=false`, `action=true`, `oplog=true`, `to=null`,
# and `room_name="oplog/0"`.  They also have three additional fields:
# `type` and `id`, which give a mongodb reference to the object
# modified so we can hyperlink to it, and stream, which maps to the
# JS Notification API 'tag' for deduping and selective muting.
export Messages = BBCollection.messages = new Mongo.Collection "messages"
if Meteor.isServer
  Messages.createIndex {to:1, room_name:1, timestamp:-1}, {}
  Messages.createIndex {to:1, timestamp:-1},
    partialFilterExpression: to: $exists: true
  Messages.createIndex {nick:1, room_name:1, timestamp:-1}, {}
  Messages.createIndex {room_name:1, timestamp:-1}, {}
  Messages.createIndex {room_name:1, starred: -1, timestamp: 1},
    partialFilterExpression: starred: true
  Messages.createIndex {timestamp: 1}, {}
  Messages.createIndex {mention: 1}, {}
  Messages.createIndex {announced_at: 1},
    partialFilterExpression: announced_at: $exists: true

# Last read message for a user in a particular chat room
#   nick: canonicalized string, as in Messages
#   room_name: string, as in Messages
#   timestamp: timestamp of last read message
# On the client, _id is room_name.
export LastRead = BBCollection.lastread = new Mongo.Collection "lastread"
if Meteor.isServer
  LastRead.createIndex {nick:1, room_name:1}, {unique:true, dropDups:true}

# Chat room presence
#   nick: canonicalized string, as in Messages
#   room_name: string, as in Messages
#   scope: what kind of presence this is. e.g. "chat", "jitsi"
#   joined_timestamp: timestamp the user joined the room
#   timestamp: 
#   bot: true if this is a bot user. Used to ignore bot presence for
#        aggregating solver minutes spent on a puzzle.
#   clients: list of:
#     connection_id: id of the connection the user is present on
#     subscription_id: a rendomly generated ID for each subscription
#     timestamp: The time of the last keepalive for this connection
export Presence = BBCollection.presence = new Mongo.Collection 'scoped_presence'
if Meteor.isServer
  Presence.createIndex {scope: 1, room_name:1, nick: 1}, {unique:true, dropDups:true}
  Presence.createIndex {"clients.timestamp": 1}, {}

# Team calendar. Expect this to contain exactly one document
#   _id: ID of calendar in Google API.
#   syncToken: token for fetching incremental updates. Server only.
export Calendar = BBCollection.calendar = new Mongo.Collection 'calendar'

# Events from the team calendar.
#   _id: ID of calendar in Google API
#   start: start time of event as ms since epoch
#   end: end time of event as ms since epoch
#   summary: name of event
#   location: location of event, which could be a URL
#   puzzle: optional id of a puzzle the event relates to.
export CalendarEvents = BBCollection.calendar_events = new Mongo.Collection 'calendar_events'
if Meteor.isServer
  CalendarEvents.createIndex {puzzle: 1}

# this reverses the name given to Mongo.Collection; that is the
# 'type' argument is the name of a server-side Mongo collection.
export collection = (type) ->
  if Object::hasOwnProperty.call(BBCollection, type)
    BBCollection[type]
  else
    throw new Meteor.Error(400, "Bad collection type: "+type)

# pretty name for (one of) this collection
export pretty_collection = (type) ->
  switch type
    when "oplogs" then "operation log"
    else type.replace(/s$/, '')
