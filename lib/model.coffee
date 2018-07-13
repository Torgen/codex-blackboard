'use strict'
# Blackboard -- data model
# Loaded on both the client and the server

# how often we send keep alive presence messages.  increase/decrease to adjust
# client/server load.
PRESENCE_KEEPALIVE_MINUTES = 2

# how many chats in a page?
MESSAGE_PAGE = 100

# this is used to yield "zero results" in collections which index by timestamp
NOT_A_TIMESTAMP = -9999

# migrate old documents with different 'answer' representation
MIGRATE_ANSWERS = false

# move pages of messages to oldmessages collection
MOVE_OLD_PAGES = true

# In order to use all threads of the machine and preserve session stickiness,
# we need to run one instance of the app per CPU and use source hashing to
# distribute load between them. (If we didn't need stickiness, we could use
# the 'cluster' node.js addon, if there was a way to insert starting the
# children into the startup code, which I haven't fonud yet.)
# Since the app does batch processing, we need to disable it in all but one
# instance. (Or we run N+1 instances, one of which doesn't serve user traffic,
# which is what we'll actually do.) We won't be able to detect that any
# particular instance is doing the batch processing, so we will use an
# environment variable / setting from json to configure it. Batch processing
# has to be enabled by default, since many users will just run meteor in dev
# mode and won't even know it's an option.
DO_BATCH_PROCESSING = do ->
  return false if Meteor.isClient
  return !(Meteor.settings.disableBatch ? process.env.DISABLE_BATCH_PROCESSING)

emojify = (s) -> share.emojify?(s) or s

# helper function: like _.throttle, but always ensures `wait` of idle time
# between invocations.  This ensures that we stay chill even if a single
# execution of the function starts to exceed `wait`.
throttle = (func, wait = 0) ->
  [context, args, running, pending] = [null, null, false, false]
  later = ->
    if pending
      run()
    else
      running = false
  run = ->
    [running, pending] = [true, false]
    try
      func.apply(context, args)
    # Note that the timeout doesn't start until the function has completed.
    Meteor.setTimeout(later, wait)
  (a...) ->
    return if pending
    [context, args] = [this, a]
    if running
      pending = true
    else
      running = true
      Meteor.setTimeout(run, 0)

BBCollection = Object.create(null) # create new object w/o any inherited cruft

# Names is a synthetic collection created by the server which indexes
# the names and ids of Rounds and Puzzles:
#   _id: mongodb id (of a element in Rounds or Puzzles)
#   type: string ("rounds", "puzzles")
#   name: string
#   canon: canonicalized version of name, for searching
Names = BBCollection.names = \
  if Meteor.isClient then new Mongo.Collection 'names' else null

# LastAnswer is a synthetic collection created by the server which gives the
# solution time of the most recently-solved puzzle.
#    _id: random UUID
#    solved: solution time
#    type: string ("puzzles" or "rounds")
#    target: id of most recently solved puzzle/round
LastAnswer = BBCollection.last_answer = \
  if Meteor.isClient then new Mongo.Collection 'last-answer' else null

# Rounds are:
#   _id: mongodb id
#   name: string
#   canon: canonicalized version of name, for searching
#   created: timestamp
#   created_by: canon of Nick
#   sort_key: timestamp. Initially created, but can be traded to other rounds.
#   touched: timestamp -- records edits to tag, order, group, etc.
#   touched_by: canon of Nick with last touch
#   solved:  timestamp -- null (not missing or zero) if not solved
#            (actual answer is in a tag w/ name "Answer")
#   solved_by:  timestamp of Nick who confirmed the answer
#   incorrectAnswers: [ { answer: "Wrong", who: "answer submitter",
#                         backsolve: ..., provided: ..., timestamp: ... }, ... ]
#   tags: [ { name: "Status", canon: "status", value: "stuck" }, ... ]
#   puzzles: [ array of puzzle _ids, in order ]
#            Preserving order is why this is a list here and not a foreign key
#            in the puzzle.
Rounds = BBCollection.rounds = new Mongo.Collection "rounds"
if DO_BATCH_PROCESSING
  Rounds._ensureIndex {canon: 1}, {unique:true, dropDups:true}
  Rounds._ensureIndex {puzzles: 1}
  Rounds._ensureIndex {sort_key: 1}
  Rounds._ensureIndex {sort_key: -1}

# Puzzles are:
#   _id: mongodb id
#   name: string
#   canon: canonicalized version of name, for searching
#   created: timestamp
#   created_by: canon of Nick
#   touched: timestamp
#   touched_by: canon of Nick with last touch
#   solved:  timestamp -- null (not missing or zero) if not solved
#            (actual answer is in a tag w/ name "Answer")
#   solved_by:  timestamp of Nick who confirmed the answer
#   incorrectAnswers: [ { answer: "Wrong", who: "answer submitter",
#                         backsolve: ..., provided: ..., timestamp: ... }, ... ]
#   tags: [ { name: "Status", canon: "status", value: "stuck" }, ... ]
#   drive: optional google drive folder id
#   spreadsheet: optional google spreadsheet id
#   doc: optional google doc id
#   puzzles: array of puzzle _ids for puzzles that feed into this.
#            absent if this isn't a meta. empty if it is, but nothing feeds into
#            it yet.
#   feedsInto: array of puzzle ids for metapuzzles this feeds into. Can be empty.
#   if a has b in its feedsInto, then b should have a in its puzzles.
#   This is kept denormalized because the lack of indexes in Minimongo would
#   make it inefficient to query on the client, and because we want to control
#   the order within a meta.
#   Note that this allows arbitrarily many meta puzzles. Also, there is no
#   requirement that a meta be fed only by puzzles in the same round.
Puzzles = BBCollection.puzzles = new Mongo.Collection "puzzles"
if DO_BATCH_PROCESSING
  Puzzles._ensureIndex {canon: 1}, {unique:true, dropDups:true}
  Puzzles._ensureIndex {feedsInto: 1}
  Puzzles._ensureIndex {puzzles: 1}

# CallIns are:
#   _id: mongodb id
#   target: _id of puzzle
#   answer: string (proposed answer to call in)
#   created: timestamp
#   created_by: canon of Nick
#   submitted_to_hq: true/false
#   backsolve: true/false
#   provided: true/false
CallIns = BBCollection.callins = new Mongo.Collection "callins"
if DO_BATCH_PROCESSING
   CallIns._ensureIndex {created: 1}, {}
   CallIns._ensureIndex {target: 1, answer: 1}, {unique:true, dropDups:true}

# Quips are:
#   _id: mongodb id
#   text: string (quip to present at callin)
#   created: timestamp
#   created_by: canon of Nick
#   last_used: timestamp (0 if never used)
#   use_count: integer
Quips = BBCollection.quips = new Mongo.Collection "quips"
if DO_BATCH_PROCESSING
  Quips._ensureIndex {last_used: 1}, {}

# Nicks are:
#   _id: mongodb id
#   name: string
#   canon: canonicalized version of name, for searching
#   located: timestamp
#   located_at: object with numeric lat/lng properties
#   priv_located, priv_located_at: these are the same as the
#     located/located_at properties, but they are updated more frequently.
#     The server throttles the updates from priv_located* to located* to
#     prevent a N^2 blowup as everyone gets updates from everyone else
#   priv_located_order: FIFO queue for location updates
#   tags: [ { name: "Real Name", canon: "real_name", value: "C. Scott Ananian" }, ... ]
# valid tags include "Real Name", "Gravatar" (email address to use for photos)
Nicks = BBCollection.nicks = new Mongo.Collection "nicks"
if DO_BATCH_PROCESSING
  Nicks._ensureIndex {canon: 1}, {unique:true, dropDups:true}
  Nicks._ensureIndex {priv_located_order: 1}, {}
  # synchronize priv_located* with located* at a throttled rate.
  # order by priv_located_order, which we'll clear when we apply the update
  # this ensures nobody gets starved for updates
  do ->
    # limit to 10 location updates/minute
    LOCATION_BATCH_SIZE = 10
    LOCATION_THROTTLE = 60*1000
    runBatch = ->
      Nicks.find({
        priv_located_order: { $exists: true, $ne: null }
      }, {
        sort: [['priv_located_order','asc']]
        limit: LOCATION_BATCH_SIZE
      }).forEach (n, i) ->
        console.log "Updating location for #{n.name} (#{i})"
        Nicks.update n._id,
          $set:
            located: n.priv_located
            located_at: n.priv_located_at
          $unset: priv_located_order: ''
    maybeRunBatch = throttle(runBatch, LOCATION_THROTTLE)
    Nicks.find({
      priv_located_order: { $exists: true, $ne: null }
    }, {
      fields: priv_located_order: 1
    }).observeChanges
      added: (id, fields) -> maybeRunBatch()
      # also run batch on removed: batch size might not have been big enough
      removed: (id) -> maybeRunBatch()

# Messages
#   body: string
#   nick: canonicalized string (may match some Nicks.canon ... or not)
#   system: boolean (true for system messages, false for user messages)
#   action: boolean (true for /me commands)
#   oplog:  boolean (true for semi-automatic operation log message)
#   presence: optional string ('join'/'part' for presence-change only)
#   bot_ignore: optional boolean (true for messages from e.g. email or twitter)
#   to:   destination of pm (optional)
#   starred: boolean. Pins this message to the top of the puzzle page or blackboard.
#   room_name: "<type>/<id>", ie "puzzle/1", "round/1".
#                             "general/0" for main chat.
#                             "oplog/0" for the operation log.
#   timestamp: timestamp
#   useful: boolean (true for useful responses from bots; not set for "fun"
#                    bot messages and commands that trigger them.)
#   useless_cmd: boolean (true if this message triggered the bot to
#                         make a not-useful response)
#
# Messages which are part of the operation log have `nick`, `message`,
# and `timestamp` set to describe what was done, when, and by who.
# They have `system=false`, `action=true`, `oplog=true`, `to=null`,
# and `room_name="oplog/0"`.  They also have three additional fields:
# `type` and `id`, which give a mongodb reference to the object
# modified so we can hyperlink to it, and stream, which maps to the
# JS Notification API 'tag' for deduping and selective muting.
Messages = BBCollection.messages = new Mongo.Collection "messages"
OldMessages = BBCollection.oldmessages = new Mongo.Collection "oldmessages"
if DO_BATCH_PROCESSING
  for M in [ Messages, OldMessages ]
    M._ensureIndex {to:1, room_name:1, timestamp:-1}, {}
    M._ensureIndex {nick:1, room_name:1, timestamp:-1}, {}
    M._ensureIndex {room_name:1, timestamp:-1}, {}
    M._ensureIndex {room_name:1, timestamp:1}, {}
    M._ensureIndex {room_name:1, starred: -1, timestamp: 1}, {}

# Pages -- paging metadata for Messages collection
#   from: timestamp (first page has from==0)
#   to: timestamp
#   room_name: corresponds to room_name in Messages collection.
#   prev: id of previous page for this room_name, or null
#   next: id of next page for this room_name, or null
#   archived: boolean (true iff this page is in oldmessages)
# Messages with from <= timestamp < to are included in a specific page.
Pages = BBCollection.pages = new Mongo.Collection "pages"
if DO_BATCH_PROCESSING
  # used in the server observe code below
  Pages._ensureIndex {room_name:1, to:-1}, {unique:true}
  # used in the publish method
  Pages._ensureIndex {next: 1, room_name:1}, {}
  # used for archiving
  Pages._ensureIndex {archived:1, next:1, to:1}, {}
  # ensure old pages have the `archived` field
  Meteor.startup ->
    Pages.find(archived: $exists: false).forEach (p) ->
      Pages.update p._id, $set: archived: false
  # move messages to oldmessages collection
  queueMessageArchive = throttle ->
    p = Pages.findOne({archived: false, next: $ne: null}, {sort:[['to','asc']]})
    return unless p?
    limit = 2 * MESSAGE_PAGE
    loop
      msgs = Messages.find({room_name: p.room_name, timestamp: $lt: p.to}, \
        {sort:[['to','asc']], limit: limit, reactive: false}).fetch()
      OldMessages.upsert(m._id, m) for m in msgs
      Pages.update(p._id, $set: archived: true) if msgs.length < limit
      Messages.remove(m._id) for m in msgs
      break if msgs.length < limit
    queueMessageArchive()
  , 60*1000 # no more than once a minute
  # watch messages collection and create pages as necessary
  do ->
    unpaged = Object.create(null)
    Messages.find({}, sort:[['timestamp','asc']]).observe
      added: (msg) ->
        room_name = msg.room_name
        # don't count pms (so we don't end up with a blank 'page')
        return if msg.to
        # add to (conservative) count of unpaged messages
        # (this message might already be in a page, but we'll catch that below)
        unpaged[room_name] = (unpaged[room_name] or 0) + 1
        return if unpaged[room_name] < MESSAGE_PAGE
        # recompute page parameters before adding a new page
        # (be safe in case we had out-of-order observations)
        # find highest existing page
        p = Pages.findOne({room_name: room_name}, {sort:[['to','desc']]})\
          or { _id: null, room_name: room_name, from: -1, to: 0 }
        # count the number of unpaged messages
        m = Messages.find(\
          {room_name: room_name, to: null, timestamp: $gte: p.to}, \
          {sort:[['timestamp','asc']], limit: MESSAGE_PAGE}).fetch()
        if m.length < MESSAGE_PAGE
          # false alarm: reset unpaged message count and continue
          unpaged[room_name] = m.length
          return
        # ok, let's make a new page.  this will include at least all the
        # messages in m, possibly more (if there are additional messages
        # added with timestamp == m[m.length-1].timestamp)
        pid = Pages.insert
          room_name: room_name
          from: p.to
          to: 1 + m[m.length-1].timestamp
          prev: p._id
          next: null
          archived: false
        if p._id?
          Pages.update p._id, $set: next: pid
        unpaged[room_name] = 0
        queueMessageArchive() if MOVE_OLD_PAGES
  # migrate messages to old messages collection
  (Meteor.startup queueMessageArchive) if MOVE_OLD_PAGES

# Last read message for a user in a particular chat room
#   nick: canonicalized string, as in Messages
#   room_name: string, as in Messages
#   timestamp: timestamp of last read message
LastRead = BBCollection.lastread = new Mongo.Collection "lastread"
if DO_BATCH_PROCESSING
  LastRead._ensureIndex {nick:1, room_name:1}, {unique:true, dropDups:true}
  LastRead._ensureIndex {nick:1}, {} # be safe

# Chat room presence
#   nick: canonicalized string, as in Messages
#   room_name: string, as in Messages
#   timestamp: timestamp -- when user was last seen in room
#   foreground: boolean (true if user's tab is still in foreground)
#   foreground_uuid: identity of client with tab in foreground
#   present: boolean (true if user is present, false if not)
Presence = BBCollection.presence = new Mongo.Collection "presence"
if DO_BATCH_PROCESSING
  Presence._ensureIndex {nick: 1, room_name:1}, {unique:true, dropDups:true}
  Presence._ensureIndex {timestamp:-1}, {}
  Presence._ensureIndex {present:1, room_name:1}, {}
  # ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
  # some leeway here to account for client/server time drift
  Meteor.setInterval ->
    #console.log "Removing entries older than", (UTCNow() - 5*60*1000)
    removeBefore = UTCNow() - (2*PRESENCE_KEEPALIVE_MINUTES*60*1000)
    Presence.remove timestamp: $lt: removeBefore
  , 60*1000
  # generate automatic "<nick> entered <room>" and <nick> left room" messages
  # as the presence set changes
  initiallySuppressPresence = true
  Presence.find(present: true).observe
    added: (presence) ->
      return if initiallySuppressPresence
      # look up a real name, if there is one
      n = Nicks.findOne canon: canonical(presence.nick)
      name = getTag(n, 'Real Name') or presence.nick
      #console.log "#{name} entered #{presence.room_name}"
      return if presence.room_name is 'oplog/0'
      Messages.insert
        system: true
        nick: presence.nick
        to: null
        presence: 'join'
        body: "#{name} joined the room."
        bodyIsHtml: false
        room_name: presence.room_name
        timestamp: UTCNow()
    removed: (presence) ->
      return if initiallySuppressPresence
      # look up a real name, if there is one
      n = Nicks.findOne canon: canonical(presence.nick)
      name = getTag(n, 'Real Name') or presence.nick
      #console.log "#{name} left #{presence.room_name}"
      return if presence.room_name is 'oplog/0'
      Messages.insert
        system: true
        nick: presence.nick
        to: null
        presence: 'part'
        body: "#{name} left the room."
        bodyIsHtml: false
        room_name: presence.room_name
        timestamp: UTCNow()
  # turn on presence notifications once initial observation set has been
  # processed. (observe doesn't return on server until initial observation
  # is complete.)
  initiallySuppressPresence = false

# this reverses the name given to Mongo.Collection; that is the
# 'type' argument is the name of a server-side Mongo collection.
collection = (type) ->
  if Object::hasOwnProperty.call(BBCollection, type)
    BBCollection[type]
  else
    throw new Meteor.Error(400, "Bad collection type: "+type)

# pretty name for (one of) this collection
pretty_collection = (type) ->
  switch type
    when "oplogs" then "operation log"
    when "oldmessages" then "old message"
    else type.replace(/s$/, '')

getTag = (object, name) ->
  (tag.value for tag in (object?.tags or []) when tag.canon is canonical(name))[0]


isStuck = (object) ->
  object? and /^stuck\b/i.test(getTag(object, 'Status') or '')

# canonical names: lowercases, all non-alphanumerics replaced with '_'
canonical = (s) ->
  s = s.toLowerCase().replace(/^\s+/, '').replace(/\s+$/, '') # lower, strip
  # suppress 's and 't
  s = s.replace(/[\'\u2019]([st])\b/g, "$1")
  # replace all non-alphanumeric with _
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_/,'').replace(/_$/,'')
  return s

drive_id_to_link = (id) ->
  "https://docs.google.com/folder/d/#{id}/edit"
spread_id_to_link = (id) ->
  "https://docs.google.com/spreadsheets/d/#{id}/edit"
doc_id_to_link = (id) ->
  "https://docs.google.com/document/d/#{id}/edit"

(->
  # private helpers, not exported
  unimplemented = -> throw new Meteor.Error(500, "Unimplemented")

  canonicalTags = (tags, who) ->
    check tags, [ObjectWith(name:NonEmptyString,value:Match.Any)]
    now = UTCNow()
    ({
      name: tag.name
      canon: canonical(tag.name)
      value: tag.value
      touched: tag.touched ? now
      touched_by: tag.touched_by ? canonical(who)
    } for tag in tags)

  huntPrefix = (type) ->
    # this is a huge hack, it's too hard to find the correct
    # round group to use.  But this helps avoid reloading the hunt software
    # every time the hunt domain changes.
    rg = Rounds.findOne({}, sort: ['sort_key'])
    if rg?.link
      return rg.link.replace(/\/+$/, '') + '/' + type + '/'
    else
      return Meteor.settings?[type+'_prefix']

  NonEmptyString = Match.Where (x) ->
    check x, String
    return x.length > 0
  # a key of BBCollection
  ValidType = Match.Where (x) ->
    check x, NonEmptyString
    Object::hasOwnProperty.call(BBCollection, x)
  # either an id, or an object containing an id
  IdOrObject = Match.OneOf NonEmptyString, Match.Where (o) ->
    typeof o is 'object' and ((check o._id, NonEmptyString) or true)
  # This is like Match.ObjectIncluding, but we don't require `o` to be
  # a plain object
  ObjectWith = (pattern) ->
    Match.Where (o) ->
      return false if typeof(o) is not 'object'
      Object.keys(pattern).forEach (k) ->
        check o[k], pattern[k]
      true

  oplog = (message, type="", id="", who="", stream="") ->
    Messages.insert
      room_name: 'oplog/0'
      nick: canonical(who)
      timestamp: UTCNow()
      body: message
      bodyIsHtml: false
      type:type
      id:id
      oplog: true
      followup: true
      action: true
      system: false
      to: null
      stream: stream

  newObject = (type, args, extra, options={}) ->
    check args, ObjectWith
      name: NonEmptyString
      who: NonEmptyString
    now = UTCNow()
    object =
      name: args.name
      canon: canonical(args.name) # for lookup
      created: now
      created_by: canonical(args.who)
      touched: now
      touched_by: canonical(args.who)
      tags: canonicalTags(args.tags or [], args.who)
    for own key,value of (extra or Object.create(null))
      object[key] = value
    try
      object._id = collection(type).insert object
    catch error
      if Meteor.isServer and error?.name is 'MongoError' and error?.code==11000
        # duplicate key, fetch the real thing
        return collection(type).findOne({canon:canonical(args.name)})
      throw error # something went wrong, who knows what, pass it on
    unless options.suppressLog
      oplog "Added", type, object._id, args.who, \
          if type in ['puzzles', 'rounds'] \
              then 'new-puzzles' else ''
    return object

  renameObject = (type, args, options={}) ->
    check args, ObjectWith
      id: NonEmptyString
      name: NonEmptyString
      who: NonEmptyString
    now = UTCNow()

    # Only perform the rename and oplog if the name is changing
    # XXX: This is racy with updates to findOne().name.
    if collection(type).findOne(args.id).name is args.name
      return false

    collection(type).update args.id, $set:
      name: args.name
      canon: canonical(args.name)
      touched: now
      touched_by: canonical(args.who)
    unless options.suppressLog
      oplog "Renamed", type, args.id, args.who
    return true

  deleteObject = (type, args, options={}) ->
    check type, ValidType
    check args, ObjectWith
      id: NonEmptyString
      who: NonEmptyString
    name = collection(type)?.findOne(args.id)?.name
    return false unless name
    unless options.suppressLog
      oplog "Deleted "+pretty_collection(type)+" "+name, \
          type, null, args.who
    collection(type).remove(args.id)
    return true

  setTagInternal = (args) ->
    check args, ObjectWith
      type: ValidType
      object: IdOrObject
      name: NonEmptyString
      value: Match.Any
      who: NonEmptyString
      now: Number
    id = args.object._id or args.object
    now = args.now
    canon = canonical(args.name)
    loop
      tags = collection(args.type).findOne(id).tags
      # remove existing value for tag, if present
      ntags = (tag for tag in tags when tag.canon isnt canon)
      # add new tag, but keep tags sorted
      ntags.push
        name:args.name
        canon:canon
        value:args.value
        touched: now
        touched_by: canonical(args.who)
      ntags.sort (a, b) -> (a?.canon or "").localeCompare (b?.canon or "")
      # update the tag set only if there wasn't a race
      numchanged = collection(args.type).update { _id: id, tags: tags }, $set:
        tags: ntags
        touched: now
        touched_by: canonical(args.who)
      # try again if this update failed due to a race (server only)
      break unless Meteor.isServer and numchanged is 0
    return true

  deleteTagInternal = (args) ->
    check args, ObjectWith
      type: ValidType
      object: IdOrObject
      name: NonEmptyString
      who: NonEmptyString
      now: Number
    id = args.object._id or args.object
    now = args.now
    canon = canonical(args.name)
    loop
      tags = collection(args.type).findOne(id).tags
      ntags = (tag for tag in tags when tag.canon isnt canon)
      # update the tag set only if there wasn't a race
      numchanged = collection(args.type).update { _id: id, tags: tags }, $set:
        tags: ntags
        touched: now
        touched_by: canonical(args.who)
      # try again if this update failed due to a race (server only)
      break unless Meteor.isServer and numchanged is 0
    return true

  newDriveFolder = (id, name) ->
    check id, NonEmptyString
    check name, NonEmptyString
    return unless Meteor.isServer
    res = share.drive.createPuzzle name
    return unless res?
    Puzzles.update id, { $set:
      drive: res.id
      spreadsheet: res.spreadId
      doc: res.docId
    }

  renameDriveFolder = (new_name, drive, spreadsheet, doc) ->
    check new_name, NonEmptyString
    check drive, NonEmptyString
    check spreadsheet, Match.Optional(NonEmptyString)
    check doc, Match.Optional(NonEmptyString)
    return unless Meteor.isServer
    share.drive.renamePuzzle(new_name, drive, spreadsheet, doc)

  deleteDriveFolder = (drive) ->
    check drive, NonEmptyString
    return unless Meteor.isServer
    share.drive.deletePuzzle drive

  moveWithinParent = (id, parentType, parentId, args) ->
    loop
      parent = collection(parentType).findOne(parentId)
      ix = parent?.puzzles?.indexOf(id)
      return false unless ix?
      npos = ix
      npuzzles = (p for p in parent.puzzles when p != id)
      if args.pos?
        npos += args.pos
        return false if npos < 0
      else if args.before?
        npos = npuzzles.indexOf args.before
        return false unless npos >= 0
      else if args.after?
        npos = 1 + npuzzles.indexOf args.after
        return false unless npos > 0
      else
        return false
      npuzzles.splice(npos, 0, id)
      return true if 0 < (collection(parentType).update {_id: parentId, puzzles: parent.puzzles}, $set:
        puzzles: npuzzles
        touched: UTCNow()
        touched_by: canonical(args.who))

  Meteor.methods
    newRound: (args) ->
      newObject "rounds", args,
        puzzles: []
        link: args.link or null
        sort_key: UTCNow()
      # TODO(torgen): create default meta
    renameRound: (args) ->
      renameObject "rounds", args
      # TODO(torgen): rename default meta
    deleteRound: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
      # disallow deletion unless round.puzzles is empty
      # TODO(torgen): ...other than default meta
      rg = Rounds.findOne(args.id)
      return false unless rg? and rg?.puzzles?.length is 0
      deleteObject "rounds", args

    newPuzzle: (args) ->
      throw new Meteor.Error(404, "bad round") unless args.round? and Rounds.findOne(args.round)?
      # TODO(torgen): if round has a default meta, set new puzzle to feed into that meta.
      puzzle_prefix = huntPrefix 'puzzle'
      link = if puzzle_prefix
        "#{puzzle_prefix}#{canonical(args.name)}"
      feedsInto = args.feedsInto or []
      extra =
        incorrectAnswers: []
        solved: null
        solved_by: null
        drive: args.drive or null
        spreadsheet: args.spreadsheet or null
        doc: args.doc or null
        link: args.link or link
        feedsInto: feedsInto
      if args.puzzles?
        extra.puzzles = args.puzzles
      p = newObject "puzzles", args, extra
      if args.puzzles?
        Puzzles.update {_id: $in: args.puzzles},
          $addToSet: feedsInto: p._id
          $set:
            touched_by: p.touched_by
            touched: p.touched
        , multi: true
      if feedsInto.length > 0
        Puzzles.update {_id: $in: feedsInto},
          $addToSet: puzzles: p._id
          $set:
            touched_by: p.touched_by
            touched: p.touched
        , multi: true
      if args.round?
        Rounds.update args.round,
          $addToSet: puzzles: p._id
          $set:
            touched_by: p.touched_by
            touched: p.touched
      # create google drive folder (server only)
      newDriveFolder p._id, p.name
      return p
    renamePuzzle: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        name: NonEmptyString
        who: NonEmptyString
      # get drive ID (racy)
      p = Puzzles.findOne(args.id)
      drive = p?.drive
      spreadsheet = p?.spreadsheet
      doc = p?.doc
      result = renameObject "puzzles", args
      # rename google drive folder
      renameDriveFolder args.name, drive, (spreadsheet if (result and drive?)), doc if (result and drive?)
      return result
    deletePuzzle: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
      pid = args.id
      # get drive ID (racy)
      old = Puzzles.findOne(args.id)
      now = UTCNow()
      drive = old?.drive
      spreadsheet = old?.spreadsheet
      doc = old?.doc
      # remove puzzle itself
      r = deleteObject "puzzles", args
      # remove from all rounds
      Rounds.update { puzzles: pid },
        $pull: puzzles: pid
        $set:
          touched: now
          touched_by: canonical args.who
      , multi: true
      # Remove from all metas
      Puzzles.update { puzzles: pid },
        $pull: puzzles: pid
        $set:
          touched: now
          touched_by: canonical args.who
      , multi: true
      # Remove from all feedsInto lists
      Puzzles.update { feedsInto: pid },
        $pull: feedsInto: pid
        $set:
          touched: now
          touched_by: canonical args.who
      , multi: true
      # delete google drive folder
      deleteDriveFolder drive, (spreadsheet if drive?), doc if drive?
      # XXX: delete chat room logs?
      return r
    makeMeta: (id) ->
      # This only fails if, for some reason, puzzles is a list containing null.
      return 0 < (Puzzles.update {_id: id, puzzles: null}, $set: puzzles: []).nModified
    makeNotMeta: (id) ->
      Puzzles.update {feedsInto: id}, {$pull: feedsInto: id}, multi: true
      return 0 < (Puzzles.update {_id: id, puzzles: $exists: true}, $unset: puzzles: "").nModified
    feedMeta: (puzzleId, metaId) ->
      Puzzles.update puzzleId, $addToSet: feedsInto: metaId
      Puzzles.update metaId, $addToSet: puzzles: puzzleId
    unfeedMeta: (puzzleId, metaId) ->
      Puzzles.update puzzleId, $pull: feedsInto: metaId
      Puzzles.update metaId, $pull: puzzles: puzzleId

    newCallIn: (args) ->
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
        who: NonEmptyString
        backsolve: Match.Optional(Boolean)
        provided: Match.Optional(Boolean)
      return if this.isSimulation # otherwise we trigger callin sound twice
      id = args.target._id or args.target
      puzzle = Puzzles.findOne(args.target)
      throw new Meteor.Error(404, "bad target") unless puzzle?
      name = puzzle.name
      backsolve = if args.backsolve then " [backsolved]" else ''
      provided = if args.provided then " [provided]" else ''
      newObject "callins", {name:name+':'+args.answer, who:args.who},
        target: id
        answer: args.answer
        who: args.who
        submitted_to_hq: false
        backsolve: !!args.backsolve
        provided: !!args.provided
      , {suppressLog:true}
      body = (opts) ->
        "is requesting a call-in for #{args.answer.toUpperCase()}" + \
        (if opts?.specifyPuzzle then " (#{name})" else "") + provided + backsolve
      msg =
        action: true
        nick: args.who
      # send to the general chat
      msg.body = body(specifyPuzzle: true)
      unless args?.suppressRoom is "general/0"
        Meteor.call 'newMessage', msg
      # send to the puzzle chat
      msg.body = body(specifyPuzzle: false)
      msg.room_name = "puzzles/#{id}"
      unless args?.suppressRoom is msg.room_name
        Meteor.call 'newMessage', msg
      # send to the metapuzzle chat
      puzzle.feedsMeta.forEach (meta) ->
        msg.body = body(specifyPuzzle: true)
        msg.room_name = "puzzles/#{meta._id}"
        unless args?.suppressRoom is msg.room_name
          Meteor.call "newMessage", msg
      oplog "New answer #{args.answer} submitted for", 'puzzles', id, \
          args.who, 'callins'

    newQuip: (args) ->
      check args, ObjectWith
        text: NonEmptyString
      # "Name" of a quip is a random name based on its hash, so the
      # oplogs don't spoil the quips.
      name = if Meteor.isSimulation
        args.text.slice(0, 16) # placeholder
      else
        RandomName(seed: args.text)
      newObject "quips", {name:name, who:args.who},
        text: args.text
        last_used: 0 # not yet used
        use_count: 0 # not yet used

    useQuip: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
        punted: Match.Optional(Boolean)
      quip = Quips.findOne args.id
      throw new Meteor.Error(404, "bad quip id") unless quip
      now = UTCNow()
      Quips.update args.id,
        $set: {last_used: now, touched: now, touched_by: canonical(args.who)}
        $inc: use_count: (if args.punted then 0 else 1)
      return if args.punted
      quipAddUrl = # see Router.urlFor
        Meteor._relativeToSiteRootUrl "/quips/new"

      Meteor.call 'newMessage',
        body: "<span class=\"bb-quip-action\">#{UI._escape(quip.text)} <a class='quips-link' href=\"#{quipAddUrl}\"></a></span>"
        action: true
        nick: args.who
        bodyIsHtml: true

    removeQuip: (args) ->
      deleteObject "quips", args

    correctCallIn: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
      callin = CallIns.findOne(args.id)
      throw new Meteor.Error(400, "bad callin") unless callin
      # call-in is cancelled as a side-effect of setAnswer
      Meteor.call "setAnswer",
        target: callin.target
        answer: callin.answer
        backsolve: callin.backsolve
        provided: callin.provided
        who: args.who
      backsolve = if callin.backsolve then "[backsolved] " else ''
      provided = if callin.provided then "[provided] " else ''
      puzzle = Puzzles.findOne(callin.target)
      return unless puzzle?
      msg =
        body: "reports that #{provided}#{backsolve}#{callin.answer.toUpperCase()} is CORRECT!"
        action: true
        nick: args.who
        room_name: "puzzles/#{callin.target}"

      # one message to the puzzle chat
      Meteor.call 'newMessage', msg

      # one message to the general chat
      delete msg.room_name
      msg.body += " (#{name})" if puzzle.name?
      Meteor.call 'newMessage', msg

      # one message to the each metapuzzle's chat
      puzzle.feedsMeta.forEach (meta) ->
        msg.room_name = "puzzles/#{meta}"
        Meteor.call 'newMessage', msg

    incorrectCallIn: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
      callin = CallIns.findOne(args.id)
      throw new Meteor.Error(400, "bad callin") unless callin
      # call-in is cancelled as a side-effect of addIncorrectAnswer
      Meteor.call "addIncorrectAnswer",
        target: callin.target
        answer: callin.answer
        backsolve: callin.backsolve
        provided: callin.provided
        who: args.who
      puzzle = Puzzles.findOne(callin.target)
      return unless puzzle?
      name = puzzle.name
      msg =
        body: "sadly relays that #{callin.answer.toUpperCase()} is INCORRECT."
        action: true
        nick: args.who
        room_name: "puzzles/#{callin.target}"
      Meteor.call 'newMessage', msg
      delete msg.room_name
      msg.body += " (#{name})" if name?
      Meteor.call 'newMessage', msg
      puzzle.feedsMeta.forEach (meta) ->
        msg.room_name = "puzzles/#{meta}"
        Meteor.call 'newMessage', msg

    cancelCallIn: (args) ->
      check args, ObjectWith
        id: NonEmptyString
        who: NonEmptyString
        suppressLog: Match.Optional(Boolean)
      callin = CallIns.findOne(args.id)
      throw new Meteor.Error(404, "bad callin") unless callin
      unless args.suppressLog
        oplog "Canceled call-in of #{callin.answer} for", 'puzzles', \
            callin.target, args.who
      deleteObject "callins",
        id: args.id
        who: args.who
      , {suppressLog:true}

    newNick: (args) ->
      check args, ObjectWith
        name: NonEmptyString
      # a bit of a stretch but let's reuse the object type
      newObject "nicks",
        name: args.name
        who: args.name
        tags: canonicalTags(args.tags or [], args.name)
      , {}, {suppressLog:true}
    renameNick: (args) ->
      renameObject "nicks", args, {suppressLog:true}
    deleteNick: (args) ->
      deleteObject "nicks", args, {suppressLog:true}
    locateNick: (args) ->
      check args, ObjectWith
        nick: NonEmptyString
        lat: Number
        lng: Number
        timestamp: Match.Optional(Number)
      return if this.isSimulation # server side only
      n = Nicks.findOne canon: canonical(args.nick)
      throw new Meteor.Error(404, "bad nick: #{args.nick}") unless n?
      # the server transfers updates from priv_located* to located* at
      # a throttled rate to prevent N^2 blow up.
      # priv_located_order implements a FIFO queue for updates, but
      # you don't lose your place if you're already in the queue
      timestamp = UTCNow()
      Nicks.update n._id, $set:
        priv_located: args.timestamp ? timestamp
        priv_located_at: { lat: args.lat, lng: args.lng }
        priv_located_order: n.priv_located_order ? timestamp

    newMessage: (args) ->
      check args, Object
      return if this.isSimulation # suppress flicker
      newMsg =
        body: args.body or ""
        bodyIsHtml: args.bodyIsHtml or false
        nick: canonical(args.nick or "")
        system: args.system or false
        action: args.action or false
        to: canonical(args.to or "") or null
        room_name: args.room_name or "general/0"
        timestamp: UTCNow()
        useful: args.useful or false
        useless_cmd: args.useless_cmd or false
      if args.oplog
        newMsg.oplog = newMsg.action = newMsg.followup = true
        newMsg.room_name = 'oplog/0'
        newMsg.stream = args.stream or ''
      # translate emojis!
      newMsg.body = emojify newMsg.body unless newMsg.bodyIsHtml
      # update the user's 'last read' message to include this one
      # (doing it here allows us to use server timestamp on message)
      unless (args.suppressLastRead or newMsg.system or newMsg.oplog or (not newMsg.nick))
        Meteor.call 'updateLastRead',
          nick: newMsg.nick
          room_name: newMsg.room_name
          timestamp: newMsg.timestamp
      newMsg._id = Messages.insert newMsg
      return newMsg

    setStarred: (id, starred) ->
      check id, NonEmptyString
      check starred, Boolean
      # Entirely premature optimization: if starring a message, assume it's
      # recent; if unstarring, assume it's old.
      if starred
        colls = [ Messages, OldMessages]
      else
        colls = [ OldMessages, Messages ]
      for coll in colls
        num = coll.update (
          _id: id
          to: null
          system: $in: [false, null]
          action: $in: [false, null]
          oplog: $in: [false, null]
          presence: null
        ), $set: {starred: starred or null}
        return if num > 0

    updateLastRead: (args) ->
      check args, ObjectWith
        nick: NonEmptyString
        room_name: NonEmptyString
        timestamp: Number
      try
        LastRead.upsert
          nick: canonical(args.nick)
          room_name: args.room_name
          timestamp: $lt: args.timestamp
        , $set:
          timestamp: args.timestamp
      catch e
        # ignore duplicate key errors; they are harmless and occur when we
        # try to move the LastRead.timestamp backwards.
        if Meteor.isServer and e?.name is 'MongoError' and e?.code==11000
          return false
        throw e

    setPresence: (args) ->
      check args, ObjectWith
        nick: NonEmptyString
        room_name: NonEmptyString
      # we're going to do the db operation only on the server, so that we
      # can safely use mongo's 'upsert' functionality.  otherwise
      # Meteor seems to get a little confused as it creates presence
      # entries on the client that don't exist on the server.
      # (meteor does better when it's reconciling the *contents* of
      # documents, not their existence) (this is also why we added the
      # 'presence' field instead of deleting entries outright when
      # a user goes away)
      # IN METEOR 0.6.6 upsert support was added to the client.  So let's
      # try to do this on both sides now.
      #return unless Meteor.isServer
      Presence.upsert
        nick: canonical(args.nick)
        room_name: args.room_name
      , $set:
          timestamp: UTCNow()
          present: args.present or false
      return unless args.present
      # only set foreground if true or foreground_uuid matches; this
      # prevents bouncing if user has two tabs open, and one is foregrounded
      # and the other is not.
      if args.foreground
        Presence.update
          nick: canonical(args.nick)
          room_name: args.room_name
        , $set:
          foreground: true
          foreground_uuid: args.uuid
      else # only update 'foreground' if uuid matches
        Presence.update
          nick: canonical(args.nick)
          room_name: args.room_name
          foreground_uuid: args.uuid
        , $set:
          foreground: args.foreground or false
      return

    get: (type, id) ->
      check type, NonEmptyString
      check id, NonEmptyString
      return collection(type).findOne(id)

    getByName: (args) ->
      check args, ObjectWith
        name: NonEmptyString
        optional_type: Match.Optional(NonEmptyString)
      for type in ['rounds','puzzles','nicks']
        continue if args.optional_type and args.optional_type isnt type
        o = collection(type).findOne canon: canonical(args.name)
        return {type:type,object:o} if o
      return null # no match found

    setField: (args) ->
      check args, ObjectWith
        type: ValidType
        object: IdOrObject
        fields: Object
        who: NonEmptyString
      id = args.object._id or args.object
      now = UTCNow()
      # disallow modifications to the following fields; use other APIs for these
      for f in ['name','canon','created','created_by','solved','solved_by',
               'tags','rounds','round_start','puzzles','incorrectAnswers',
               'located','located_at',
               'priv_located','priv_located_at','priv_located_order']
        delete args.fields[f]
      args.fields.touched = now
      args.fields.touched_by = canonical(args.who)
      collection(args.type).update id, $set: args.fields
      return true

    setTag: (args) ->
      check args, ObjectWith
        name: NonEmptyString
      # bail to setAnswer/deleteAnswer if this is the 'answer' tag.
      if canonical(args.name) is 'answer'
        return Meteor.call (if args.value then "setAnswer" else "deleteAnswer"),
          type: args.type
          target: args.object
          answer: args.value
          who: args.who
      if canonical(args.name) is 'status'
        return Meteor.call (if args.value then "summon" else "unsummon"),
          type: args.type
          object: args.object
          value: args.value
          who: args.who
      if canonical(args.name) is 'link'
        args.fields = { link: args.value }
        return Meteor.call 'setField', args
      args.now = UTCNow() # don't let caller lie about the time
      return setTagInternal args

    deleteTag: (args) ->
      check args, ObjectWith
        name: NonEmptyString
      # bail to deleteAnswer if this is the 'answer' tag.
      if canonical(args.name) is 'answer'
        return Meteor.call "deleteAnswer",
          type: args.type
          target: args.object
          who: args.who
      if canonical(args.name) is 'status'
        return Meteor.call 'unsummon',
          type: args.type
          object: args.object
          who: args.who
      if canonical(args.name) is 'link'
        args.fields = { link: null }
        return Meteor.call 'setField', args
      args.now = UTCNow() # don't let caller lie about the time
      return deleteTagInternal args

    summon: (args) ->
      check args, ObjectWith
        object: IdOrObject
        who: NonEmptyString
        how: Match.Optional(NonEmptyString)
      id = args.object._id or args.object
      obj = Puzzles.findOne id
      if not obj?
        return "Couldn't find puzzle #{id}"
      if obj.solved
        return "puzzle #{obj.name} is already answered"
      wasStuck = isStuck obj
      how = args.how or 'Stuck'
      setTagInternal
        object: id
        type: 'puzzles'
        name: 'Status'
        value: how
        who: args.who
        now: UTCNow()
      if wasStuck
        return
      oplog "Help requested for", 'puzzles', id, args.who, 'stuck'
      body = "has requested help: #{how}"
      Meteor.call 'newMessage',
        nick: args.who
        action: true
        body: body
        room_name: "puzzles/#{id}"
      objUrl = # see Router.urlFor
        Meteor._relativeToSiteRootUrl "/puzzles/#{id}"
      body = "has requested help: #{UI._escape how} (puzzle <a class=\"puzzles-link\" href=\"#{objUrl}\">#{UI._escape obj.name}</a>)"
      Meteor.call 'newMessage',
        nick: args.who
        action: true
        bodyIsHtml: true
        body: body
      return

    unsummon: (args) ->
      check args, ObjectWith
        object: IdOrObject
        who: NonEmptyString
      id = args.object._id or args.object
      obj = Puzzles.findOne id
      if not obj?
        return "Couldn't find puzzle #{id}"
      if not (isStuck obj)
        return "puzzle #{obj.name} isn't stuck"
      oplog "Help request cancelled for", 'puzzles', id, args.who
      sticker = (tag.touched_by for tag in obj.tags when tag.canon is 'status')?[0] or 'nobody'
      deleteTagInternal
        object: id
        type: 'puzzles'
        name: 'status'
        who: args.who
        now: UTCNow()
      body = "has arrived to help"
      if canonical(args.who) is sticker
        body = "no longer needs help getting unstuck"
      Meteor.call 'newMessage',
        nick: args.who
        action: true
        body: body
        room_name: "puzzles/#{id}"
      body = "#{body} in puzzle #{obj.name}"
      Meteor.call 'newMessage',
        nick: args.who
        action: true
        body: body
      return

    getRoundForPuzzle: (puzzle) ->
      check puzzle, IdOrObject
      id = puzzle._id or puzzle
      check id, NonEmptyString
      return Rounds.findOne(puzzles: id)

    moveWithinMeta: (id, parentId, args) ->
      moveWithinParent id, 'puzzles', parentId, args

    moveWithinRound: (id, parentId, args) ->
      console.log id, parentId, args
      moveWithinParent id, 'rounds', parentId, args

    moveRound: (id, dir) ->
      round = Rounds.findOne(id)
      order = 'asc'
      op = '$gt'
      if dir < 0
        order = 'desc'
        op = '$lt'
      query = {}
      query[op] = round.sort_key
      cursor = Rounds.find(sort_key: query).sort(sort_key: order).limit(1)
      arr = cursor.toArray()
      return if arr.length is 0
      last = arr[0]
      Rounds.update id, $set: sort_key: last.sort_key
      Rounds.update last._id, $set: sort_key: round.sort_key

    setAnswer: (args) ->
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
        who: NonEmptyString
        backsolve: Match.Optional(Boolean)
        provided: Match.Optional(Boolean)
      id = args.target._id or args.target

      # Only perform the update and oplog if the answer is changing
      oldAnswer = (tag for tag in Puzzles.findOne(id).tags \
                      when tag.canon is 'answer')[0]?.value
      if oldAnswer is args.answer
        return false

      now = UTCNow()
      setTagInternal
        type: 'puzzles'
        object: args.target
        name: 'Answer'
        value: args.answer
        who: args.who
        now: now
      deleteTagInternal
        type: 'puzzles'
        object: args.target
        name: 'status'
        who: args.who
        now: now
      if args.backsolve
        setTagInternal
          type: 'puzzles'
          object: args.target
          name: 'Backsolve'
          value: 'yes'
          who: args.who
          now: now
      if args.provided
        setTagInternal
          type: 'puzzles'
          object: args.target
          name: 'Provided'
          value: 'yes'
          who: args.who
          now: now
      Puzzles.update id, $set:
        solved: now
        solved_by: canonical(args.who)
        touched: now
        touched_by: canonical(args.who)
      oplog "Found an answer (#{args.answer.toUpperCase()}) to", 'puzzles', id, args.who, 'answers'
      # cancel any entries on the call-in queue for this puzzle
      for c in CallIns.find(target: id).fetch()
        Meteor.call 'cancelCallIn',
          id: c._id
          who: args.who
          suppressLog: (c.answer is args.answer)
      return true

    addIncorrectAnswer: (args) ->
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
        who: NonEmptyString
        backsolve: Match.Optional(Boolean)
        provided: Match.Optional(Boolean)
      id = args.target._id or args.target
      now = UTCNow()

      target = Puzzles.findOne(id)
      throw new Meteor.Error(400, "bad target") unless target
      Puzzles.update id, $push:
        incorrectAnswers:
          answer: args.answer
          timestamp: UTCNow()
          who: args.who
          backsolve: !!args.backsolve
          provided: !!args.provided

      oplog "reports incorrect answer #{args.answer} for", 'puzzles', id, args.who, \
          'callins'
      # cancel any matching entries on the call-in queue for this puzzle
      for c in CallIns.find(target: id, answer: args.answer).fetch()
        Meteor.call 'cancelCallIn',
          id: c._id
          who: args.who
          suppressLog: true
      return true

    deleteAnswer: (args) ->
      check args, ObjectWith
        target: IdOrObject
        who: NonEmptyString
      id = args.target._id or args.target
      now = UTCNow()
      # TODO(Torgen): Use $pullAll to remove these.
      deleteTagInternal
        type: 'puzzles'
        object: args.target
        name: 'Answer'
        who: args.who
        now: now
      deleteTagInternal
        type: 'puzzles'
        object: args.target
        name: 'Backsolve'
        who: args.who
        now: now
      deleteTagInternal
        type: 'puzzles'
        object: args.target
        name: 'Provided'
        who: args.who
        now: now
      Puzzles.update id, $set:
        solved: null
        solved_by: null
        touched: now
        touched_by: canonical(args.who)
      oplog "Deleted answer for", 'puzzles', id, args.who
      return true

    getRinghuntersFolder: ->
      return unless Meteor.isServer
      # Return special folder used for uploads to general Ringhunters chat
      return share.drive.ringhuntersFolder

    # if a round/puzzle folder gets accidentally deleted, this can be used to
    # manually re-create it.
    fixPuzzleFolder: (args) ->
      check args, ObjectWith
        type: ValidType
        object: IdOrObject
        name: NonEmptyString
      id = args.object._id or args.object
      newDriveFolder id, args.name
)()

UTCNow = -> Date.now()

# exports
share.model =
  # constants
  PRESENCE_KEEPALIVE_MINUTES: PRESENCE_KEEPALIVE_MINUTES
  MESSAGE_PAGE: MESSAGE_PAGE
  NOT_A_TIMESTAMP: NOT_A_TIMESTAMP
  DO_BATCH_PROCESSING: DO_BATCH_PROCESSING
  # collection types
  CallIns: CallIns
  Quips: Quips
  Names: Names
  LastAnswer: LastAnswer
  Rounds: Rounds
  Puzzles: Puzzles
  Nicks: Nicks
  Messages: Messages
  OldMessages: OldMessages
  Pages: Pages
  LastRead: LastRead
  Presence: Presence
  # helper methods
  collection: collection
  pretty_collection: pretty_collection
  getTag: getTag
  isStuck: isStuck
  canonical: canonical
  drive_id_to_link: drive_id_to_link
  spread_id_to_link: spread_id_to_link
  doc_id_to_link: doc_id_to_link
  UTCNow: UTCNow
