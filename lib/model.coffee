'use strict'

import canonical from './imports/canonical.coffee'
import { ArrayMembers, ArrayWithLength, NumberInRange, NonEmptyString, IdOrObject, ObjectWith } from './imports/match.coffee'
import { getTag, isStuck, canonicalTags } from './imports/tags.coffee'

# Blackboard -- data model
# Loaded on both the client and the server

# how often we send keep alive presence messages.  increase/decrease to adjust
# client/server load.
PRESENCE_KEEPALIVE_MINUTES = 2

# this is used to yield "zero results" in collections which index by timestamp
NOT_A_TIMESTAMP = -9999

emojify = if Meteor.isServer
  require('../server/imports/emoji.coffee').default
else
  (s) -> s

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
#   tags: status: { name: "Status", value: "stuck" }, ... 
#   puzzles: [ array of puzzle _ids, in order ]
#            Preserving order is why this is a list here and not a foreign key
#            in the puzzle.
Rounds = BBCollection.rounds = new Mongo.Collection "rounds"
if Meteor.isServer
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
#   tags: status: { name: "Status", value: "stuck" }, ... 
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
if Meteor.isServer
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
if Meteor.isServer
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
if Meteor.isServer
  Quips._ensureIndex {last_used: 1}, {}

# Polls are:
#   _id: mongodb id
#   created: timestamp of creation
#   created_by: userId of creator
#   question: "poll question"
#   options: list of {canon: "canonical text", option: "original text"}
#   votes: document where keys are canonical user names and values are {canon: "canonical text" timestamp: timestamp of vote}
Polls = BBCollection.polls = new Mongo.Collection "polls"

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
if Meteor.isServer
  Meteor.users._ensureIndex {priv_located_order: 1},
    partialFilterExpression:
      priv_located_order: { $exists: true }
  # We don't push the index to the client, so it's okay to have it update
  # frequently.
  Meteor.users._ensureIndex {priv_located_at: '2dsphere'}, {}

# Messages
#   body: string
#   nick: canonicalized string (may match some Nicks.canon ... or not)
#   system: boolean (true for system messages, false for user messages)
#   action: boolean (true for /me commands)
#   oplog:  boolean (true for semi-automatic operation log message)
#   presence: optional string ('join'/'part' for presence-change only)
#   bot_ignore: optional boolean (true for messages from e.g. email or twitter)
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
if Meteor.isServer
  for M in [ Messages, OldMessages ]
    M._ensureIndex {to:1, room_name:1, timestamp:-1}, {}
    M._ensureIndex {nick:1, room_name:1, timestamp:-1}, {}
    M._ensureIndex {room_name:1, timestamp:-1}, {}
    M._ensureIndex {room_name:1, timestamp:1}, {}
    M._ensureIndex {room_name:1, starred: -1, timestamp: 1},
      partialFilterExpression: starred: true
    M._ensureIndex {timestamp: 1}, {}

# Pages -- paging metadata for Messages collection
#   from: timestamp (first page has from==0)
#   to: timestamp
#   room_name: corresponds to room_name in Messages collection.
#   prev: id of previous page for this room_name, or null
#   next: id of next page for this room_name, or null
#   archived: boolean (true iff this page is in oldmessages)
# Messages with from <= timestamp < to are included in a specific page.
Pages = BBCollection.pages = new Mongo.Collection "pages"
if Meteor.isServer
  # used in the observe code in server/batch.coffee
  Pages._ensureIndex {room_name:1, to:-1}, {unique:true}
  # used in the publish method
  Pages._ensureIndex {next: 1, room_name:1}, {}
  # used for archiving
  Pages._ensureIndex {archived:1, next:1, to:1}, {}

# Last read message for a user in a particular chat room
#   nick: canonicalized string, as in Messages
#   room_name: string, as in Messages
#   timestamp: timestamp of last read message
LastRead = BBCollection.lastread = new Mongo.Collection "lastread"
if Meteor.isServer
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
if Meteor.isServer
  Presence._ensureIndex {nick: 1, room_name:1}, {unique:true, dropDups:true}
  Presence._ensureIndex {timestamp:-1}, {}
  Presence._ensureIndex {present:1, room_name:1}, {}

# Global dynamic settings
#  _id: canonical form of name
#  name: human readable name for setting
#  description: What the setting does
#  value: Current value of the setting
#  default: default value of the setting
#  touched: when the setting was changed
#  touched_by: who last changed the setting
Settings = BBCollection.settings = new Mongo.Collection 'settings'

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

drive_id_to_link = (id) ->
  "https://docs.google.com/folder/d/#{id}/edit"
spread_id_to_link = (id) ->
  "https://docs.google.com/spreadsheets/d/#{id}/edit"
doc_id_to_link = (id) ->
  "https://docs.google.com/document/d/#{id}/edit"

(->
  # private helpers, not exported
  unimplemented = -> throw new Meteor.Error(500, "Unimplemented")

  isDuplicateError = (error) ->
    Meteor.isServer and error?.name in ['MongoError', 'BulkWriteError'] and error?.code==11000

  huntPrefix = (type) ->
    # this is a huge hack, it's too hard to find the correct
    # round group to use.  But this helps avoid reloading the hunt software
    # every time the hunt domain changes.
    rg = Rounds.findOne({}, sort: ['sort_key'])
    if rg?.link
      return rg.link.replace(/\/+$/, '') + '/' + type + '/'
    else
      return Meteor.settings?[type+'_prefix']

  # a key of BBCollection
  ValidType = Match.Where (x) ->
    check x, NonEmptyString
    Object::hasOwnProperty.call(BBCollection, x)
    
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
      if isDuplicateError error
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

    try
      collection(type).update args.id, $set:
        name: args.name
        canon: canonical(args.name)
        touched: now
        touched_by: canonical(args.who)
    catch error
      # duplicate name--bail out
      if isDuplicateError error
        return false
      throw error
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

  setTagInternal = (updateDoc, args) ->
    check args, ObjectWith
      name: NonEmptyString
      value: Match.Any
      who: NonEmptyString
      now: Number
    updateDoc.$set ?= {}
    updateDoc.$set["tags.#{canonical(args.name)}"] = 
      name: args.name
      value: args.value
      touched: args.now
      touched_by: canonical(args.who)
    true

  deleteTagInternal = (updateDoc, name) ->
    check name, NonEmptyString
    updateDoc.$unset ?= {}
    updateDoc.$unset["tags.#{canonical(name)}"] = ''
    true

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
    check id, NonEmptyString
    check parentType, ValidType
    check parentId, NonEmptyString
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
      check @userId, NonEmptyString
      round_prefix = Settings.findOne('round_url_prefix')?.value
      link = if round_prefix
        round_prefix += '/' unless round_prefix.endsWith '/'
        "#{round_prefix}#{canonical(args.name)}"
      newObject "rounds", {args..., who: @userId},
        puzzles: []
        link: args.link or link
        sort_key: UTCNow()
      # TODO(torgen): create default meta
    renameRound: (args) ->
      check @userId, NonEmptyString
      renameObject "rounds", {args..., who: @userId}
      # TODO(torgen): rename default meta
    deleteRound: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      # disallow deletion unless round.puzzles is empty
      # TODO(torgen): ...other than default meta
      rg = Rounds.findOne id
      return false unless rg? and rg?.puzzles?.length is 0
      deleteObject "rounds", {id, who: @userId}

    newPuzzle: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        round: NonEmptyString
        feedsInto: Match.Optional [NonEmptyString]
        puzzles: Match.Optional [NonEmptyString]
      throw new Meteor.Error(404, "bad round") unless Rounds.findOne(args.round)?
      puzzle_prefix = Settings.findOne('puzzle_url_prefix')?.value
      link = if puzzle_prefix
        puzzle_prefix += '/' unless puzzle_prefix.endsWith '/'
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
      p = newObject "puzzles", {args..., who: @userId}, extra
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
      check @userId, NonEmptyString
      check args, ObjectWith
        id: NonEmptyString
        name: NonEmptyString
      # get drive ID (racy)
      p = Puzzles.findOne args.id
      drive = p?.drive
      spreadsheet = p?.spreadsheet if drive?
      doc = p?.doc if drive?
      result = renameObject "puzzles", {args..., who: @userId}
      # rename google drive folder
      renameDriveFolder args.name, drive, spreadsheet, doc if result and drive?
      return result
    deletePuzzle: (pid) ->
      check @userId, NonEmptyString
      check pid, NonEmptyString
      # get drive ID (racy)
      old = Puzzles.findOne pid
      now = UTCNow()
      drive = old?.drive
      # remove puzzle itself
      r = deleteObject "puzzles", {id: pid, who: @userId}
      # remove from all rounds
      Rounds.update { puzzles: pid },
        $pull: puzzles: pid
        $set:
          touched: now
          touched_by: @userId
      , multi: true
      # Remove from all metas
      Puzzles.update { puzzles: pid },
        $pull: puzzles: pid
        $set:
          touched: now
          touched_by: @userId
      , multi: true
      # Remove from all feedsInto lists
      Puzzles.update { feedsInto: pid },
        $pull: feedsInto: pid
        $set:
          touched: now
          touched_by: @userId
      , multi: true
      # delete google drive folder
      deleteDriveFolder drive if drive?
      # XXX: delete chat room logs?
      return r

    makeMeta: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      now = UTCNow()
      # This only fails if, for some reason, puzzles is a list containing null.
      return 0 < Puzzles.update {_id: id, puzzles: null}, $set:
        puzzles: []
        touched: now
        touched_by: @userId

    makeNotMeta: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      now = UTCNow()
      return 0 < Puzzles.update {_id: id, puzzles: []},
        $unset: puzzles: ""
        $set:
          touched: now
          touched_by: @userId

    feedMeta: (puzzleId, metaId) ->
      check @userId, NonEmptyString
      check puzzleId, NonEmptyString
      check metaId, NonEmptyString
      throw new Meteor.Error(404, 'No such meta') unless Puzzles.findOne(metaId)?
      throw new Meteor.Error(404, 'No such puzzle') unless Puzzles.findOne(puzzleId)?
      now = UTCNow()
      Puzzles.update
        _id: puzzleId
        feedsInto: $ne: metaId
      ,
        $addToSet: feedsInto: metaId
        $set: 
          touched: now
          touched_by: @userId
      return 0 < Puzzles.update
        _id: metaId
        puzzles: $ne: puzzleId
      ,
        $addToSet: puzzles: puzzleId
        $set: 
          touched: now
          touched_by: @userId

    unfeedMeta: (puzzleId, metaId) ->
      check @userId, NonEmptyString
      check puzzleId, NonEmptyString
      check metaId, NonEmptyString
      throw new Meteor.Error(404, 'No such meta') unless Puzzles.findOne(metaId)?
      throw new Meteor.Error(404, 'No such puzzle') unless Puzzles.findOne(puzzleId)?
      now = UTCNow()
      Puzzles.update
        _id: puzzleId
        feedsInto: metaId
      ,
        $pull: feedsInto: metaId
        $set: 
          touched: now
          touched_by: @userId
      return 0 < Puzzles.update
        _id: metaId
        puzzles: puzzleId
      ,
        $pull: puzzles: puzzleId
        $set: 
          touched: now
          touched_by: @userId

    newCallIn: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
        backsolve: Match.Optional(Boolean)
        provided: Match.Optional(Boolean)
      return if this.isSimulation # otherwise we trigger callin sound twice
      id = args.target._id or args.target
      puzzle = Puzzles.findOne(args.target)
      throw new Meteor.Error(404, "bad target") unless puzzle?
      name = puzzle.name
      backsolve = if args.backsolve then " [backsolved]" else ''
      provided = if args.provided then " [provided]" else ''
      newObject "callins", {name:"#{name}:#{args.answer}", who:@userId},
        target: id
        answer: args.answer
        who: @userId
        submitted_to_hq: false
        backsolve: !!args.backsolve
        provided: !!args.provided
      , {suppressLog:true}
      body = (opts) ->
        "is requesting a call-in for #{args.answer.toUpperCase()}" + \
        (if opts?.specifyPuzzle then " (#{name})" else "") + provided + backsolve
      msg = action: true
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
      puzzle.feedsInto.forEach (meta) ->
        msg.body = body(specifyPuzzle: true)
        msg.room_name = "puzzles/#{meta}"
        unless args?.suppressRoom is msg.room_name
          Meteor.call "newMessage", msg
      oplog "New answer #{args.answer} submitted for", 'puzzles', id, \
          @userId, 'callins'

    newQuip: (text) ->
      check @userId, NonEmptyString
      check text, NonEmptyString
      # "Name" of a quip is a random name based on its hash, so the
      # oplogs don't spoil the quips.
      name = if Meteor.isSimulation
        text.slice(0, 16) # placeholder
      else
        RandomName(seed: text)
      newObject "quips", {name:name, who:@userId},
        text: text
        last_used: 0 # not yet used
        use_count: 0 # not yet used

    useQuip: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        id: NonEmptyString
        punted: Match.Optional(Boolean)
      quip = Quips.findOne args.id
      throw new Meteor.Error(404, "bad quip id") unless quip
      now = UTCNow()
      Quips.update args.id,
        $set: {last_used: now, touched: now, touched_by: @userId}
        $inc: use_count: (if args.punted then 0 else 1)
      return if args.punted
      quipAddUrl = # see Router.urlFor
        Meteor._relativeToSiteRootUrl "/quips/new"

      Meteor.call 'newMessage',
        body: "<span class=\"bb-quip-action\">#{UI._escape(quip.text)} <a class='quips-link' href=\"#{quipAddUrl}\"></a></span>"
        action: true
        bodyIsHtml: true

    removeQuip: (id) ->
      check @userId, NonEmptyString
      deleteObject "quips", {id, who: @userId}

    correctCallIn: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      # call-in is cancelled as a side-effect of setAnswer
      Meteor.call "setAnswer",
        target: callin.target
        answer: callin.answer
        backsolve: callin.backsolve
        provided: callin.provided
      backsolve = if callin.backsolve then "[backsolved] " else ''
      provided = if callin.provided then "[provided] " else ''
      puzzle = Puzzles.findOne(callin.target)
      return unless puzzle?
      msg =
        body: "reports that #{provided}#{backsolve}#{callin.answer.toUpperCase()} is CORRECT!"
        action: true
        room_name: "puzzles/#{callin.target}"

      # one message to the puzzle chat
      Meteor.call 'newMessage', msg

      # one message to the general chat
      delete msg.room_name
      msg.body += " (#{puzzle.name})" if puzzle.name?
      Meteor.call 'newMessage', msg

      # one message to the each metapuzzle's chat
      puzzle.feedsInto.forEach (meta) ->
        msg.room_name = "puzzles/#{meta}"
        Meteor.call 'newMessage', msg

    incorrectCallIn: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      # call-in is cancelled as a side-effect of addIncorrectAnswer
      Meteor.call "addIncorrectAnswer",
        target: callin.target
        answer: callin.answer
        backsolve: callin.backsolve
        provided: callin.provided
      puzzle = Puzzles.findOne(callin.target)
      return unless puzzle?
      name = puzzle.name
      msg =
        body: "sadly relays that #{callin.answer.toUpperCase()} is INCORRECT."
        action: true
        room_name: "puzzles/#{callin.target}"
      Meteor.call 'newMessage', msg
      delete msg.room_name
      msg.body += " (#{name})" if name?
      Meteor.call 'newMessage', msg
      puzzle.feedsInto.forEach (meta) ->
        msg.room_name = "puzzles/#{meta}"
        Meteor.call 'newMessage', msg

    cancelCallIn: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        id: NonEmptyString
        suppressLog: Match.Optional(Boolean)
      callin = CallIns.findOne(args.id)
      throw new Meteor.Error(404, "bad callin") unless callin
      unless args.suppressLog
        oplog "Canceled call-in of #{callin.answer} for", 'puzzles', \
            callin.target, @userId
      deleteObject "callins",
        id: args.id
        who: @userId
      , {suppressLog:true}

    locateNick: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        location:
          type: 'Point'
          coordinates: ArrayMembers [NumberInRange(min: -180, max:180), NumberInRange(min: -90, max: 90)]
        timestamp: Match.Optional(Number)
      return if this.isSimulation # server side only
      # the server transfers updates from priv_located* to located* at
      # a throttled rate to prevent N^2 blow up.
      # priv_located_order implements a FIFO queue for updates, but
      # you don't lose your place if you're already in the queue
      timestamp = UTCNow()
      n = Meteor.users.update @userId,
        $set:
          priv_located: args.timestamp ? timestamp
          priv_located_at: args.location
        $min: priv_located_order: timestamp
      throw new Meteor.Error(400, "bad userId: #{@userId}") unless n > 0

    newMessage: (args) ->
      check @userId, NonEmptyString
      check args, Object
      return if this.isSimulation # suppress flicker
      newMsg =
        body: args.body or ""
        bodyIsHtml: args.bodyIsHtml or false
        nick: @userId
        system: args.system or false
        action: args.action or false
        to: canonical(args.to or "") or null
        poll: args.poll or null
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
      unless (args.suppressLastRead or newMsg.system or newMsg.oplog)
        Meteor.call 'updateLastRead',
          room_name: newMsg.room_name
          timestamp: newMsg.timestamp
      newMsg._id = Messages.insert newMsg
      return newMsg

    setStarred: (id, starred) ->
      check @userId, NonEmptyString
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
      check @userId, NonEmptyString
      check args, ObjectWith
        room_name: NonEmptyString
        timestamp: Number
      LastRead.upsert
        nick: @userId
        room_name: args.room_name
      , $max:
        timestamp: args.timestamp

    setPresence: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        room_name: NonEmptyString
        present: Match.Optional Boolean
        foreground: Match.Optional Boolean
        uuid: Match.Optional NonEmptyString
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
        nick: @userId
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
          nick: @userId
          room_name: args.room_name
        , $set:
          foreground: true
          foreground_uuid: args.uuid
      else # only update 'foreground' if uuid matches
        Presence.update
          nick: @userId
          room_name: args.room_name
          foreground_uuid: args.uuid
        , $set:
          foreground: args.foreground or false
      return

    get: (type, id) ->
      check @userId, NonEmptyString
      check type, NonEmptyString
      check id, NonEmptyString
      return collection(type).findOne(id)

    getByName: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        name: NonEmptyString
        optional_type: Match.Optional(NonEmptyString)
      for type in ['rounds','puzzles']
        continue if args.optional_type and args.optional_type isnt type
        o = collection(type).findOne canon: canonical(args.name)
        return {type:type,object:o} if o
      unless args.optional_type and args.optional_type isnt 'nicks'
        o = Meteor.users.findOne canonical args.name
        return {type: 'nicks', object: o} if o

    setField: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        type: ValidType
        object: IdOrObject
        fields: Object
      id = args.object._id or args.object
      now = UTCNow()
      # disallow modifications to the following fields; use other APIs for these
      for f in ['name','canon','created','created_by','solved','solved_by',
               'tags','puzzles','incorrectAnswers', 'feedsInto',
               'located','located_at',
               'priv_located','priv_located_at','priv_located_order']
        delete args.fields[f]
      args.fields.touched = now
      args.fields.touched_by = @userId
      collection(args.type).update id, $set: args.fields
      return true

    setTag: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        name: NonEmptyString
        type: ValidType
        object: IdOrObject
        value: String
      # bail to setAnswer/deleteAnswer if this is the 'answer' tag.
      if canonical(args.name) is 'answer'
        return Meteor.call (if args.value then "setAnswer" else "deleteAnswer"),
          type: args.type
          target: args.object
          answer: args.value
      if canonical(args.name) is 'link'
        args.fields = { link: args.value }
        return Meteor.call 'setField', args
      args.now = UTCNow() # don't let caller lie about the time
      updateDoc = $set:
        touched: args.now
        touched_by: @userId
      id = args.object._id or args.object
      setTagInternal updateDoc, {args..., who: @userId}
      0 < collection(args.type).update id, updateDoc

    deleteTag: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        name: NonEmptyString
        type: ValidType
        object: IdOrObject
      id = args.object._id or args.object
      # bail to deleteAnswer if this is the 'answer' tag.
      if canonical(args.name) is 'answer'
        return Meteor.call "deleteAnswer",
          type: args.type
          target: args.object
      if canonical(args.name) is 'link'
        args.fields = { link: null }
        return Meteor.call 'setField', args
      args.now = UTCNow() # don't let caller lie about the time
      updateDoc = $set:
        touched: args.now
        touched_by: @userId
      deleteTagInternal updateDoc, args.name
      0 < collection(args.type).update id, updateDoc

    summon: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        object: IdOrObject
        how: Match.Optional(NonEmptyString)
      id = args.object._id or args.object
      obj = Puzzles.findOne id
      if not obj?
        return "Couldn't find puzzle #{id}"
      if obj.solved
        return "puzzle #{obj.name} is already answered"
      wasStuck = isStuck obj
      rawhow = args.how or 'Stuck'
      how = if rawhow.toLowerCase().startsWith('stuck') then rawhow else "Stuck: #{rawhow}"
      Meteor.call 'setTag',
        object: id
        type: 'puzzles'
        name: 'Status'
        value: how
        now: UTCNow()
      if isStuck obj
        return
      oplog "Help requested for", 'puzzles', id, @userId, 'stuck'
      body = "has requested help: #{rawhow}"
      Meteor.call 'newMessage',
        action: true
        body: body
        room_name: "puzzles/#{id}"
      objUrl = # see Router.urlFor
        Meteor._relativeToSiteRootUrl "/puzzles/#{id}"
      body = "has requested help: #{UI._escape rawhow} (puzzle <a class=\"puzzles-link\" href=\"#{objUrl}\">#{UI._escape obj.name}</a>)"
      Meteor.call 'newMessage',
        action: true
        bodyIsHtml: true
        body: body
      return

    unsummon: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        object: IdOrObject
      id = args.object._id or args.object
      obj = Puzzles.findOne id
      if not obj?
        return "Couldn't find puzzle #{id}"
      if not (isStuck obj)
        return "puzzle #{obj.name} isn't stuck"
      oplog "Help request cancelled for", 'puzzles', id, @userId
      sticker = obj.tags.status?.touched_by
      Meteor.call 'deleteTag',
        object: id
        type: 'puzzles'
        name: 'status'
        now: UTCNow()
      body = "has arrived to help"
      if @userId is sticker
        body = "no longer needs help getting unstuck"
      Meteor.call 'newMessage',
        action: true
        body: body
        room_name: "puzzles/#{id}"
      body = "#{body} in puzzle #{obj.name}"
      Meteor.call 'newMessage',
        action: true
        body: body
      return

    getRoundForPuzzle: (puzzle) ->
      check @userId, NonEmptyString
      check puzzle, IdOrObject
      id = puzzle._id or puzzle
      check id, NonEmptyString
      return Rounds.findOne(puzzles: id)

    moveWithinMeta: (id, parentId, args) ->
      check @userId, NonEmptyString
      args.who = @userId
      moveWithinParent id, 'puzzles', parentId, args

    moveWithinRound: (id, parentId, args) ->
      check @userId, NonEmptyString
      args.who = @userId
      moveWithinParent id, 'rounds', parentId, args

    moveRound: (id, dir) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      round = Rounds.findOne(id)
      order = 1
      op = '$gt'
      if dir < 0
        order = -1
        op = '$lt'
      query = {}
      query[op] = round.sort_key
      last = Rounds.findOne {sort_key: query}, sort: {sort_key: order}
      return unless last?
      Rounds.update id, $set: sort_key: last.sort_key
      Rounds.update last._id, $set: sort_key: round.sort_key
      return

    setAnswer: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
        backsolve: Match.Optional(Boolean)
        provided: Match.Optional(Boolean)
      id = args.target._id or args.target

      # Only perform the update and oplog if the answer is changing
      oldAnswer = Puzzles.findOne(id)?.tags.answer?.value
      if oldAnswer is args.answer
        return false

      now = UTCNow()
      updateDoc = $set:
        solved: now
        solved_by: @userId
        touched: now
        touched_by: @userId
      setTagInternal updateDoc,
        name: 'Answer'
        value: args.answer
        who: @userId
        now: now
      deleteTagInternal updateDoc, 'status'
      if args.backsolve
        setTagInternal updateDoc,
          name: 'Backsolve'
          value: 'yes'
          who: @userId
          now: now
      else
        deleteTagInternal updateDoc, 'Backsolve'
      if args.provided
        setTagInternal updateDoc,
          name: 'Provided'
          value: 'yes'
          who: @userId
          now: now
      else
        deleteTagInternal updateDoc, 'Provided'
      updated = Puzzles.update
        _id: id
        'tags.answer.value': $ne: args.answer
      , updateDoc
      return false if updated is 0
      oplog "Found an answer (#{args.answer.toUpperCase()}) to", 'puzzles', id, @userId, 'answers'
      # cancel any entries on the call-in queue for this puzzle
      for c in CallIns.find(target: id).fetch()
        Meteor.call 'cancelCallIn',
          id: c._id
          suppressLog: (c.answer is args.answer)
      return true

    addIncorrectAnswer: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        target: IdOrObject
        answer: NonEmptyString
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
          who: @userId
          backsolve: !!args.backsolve
          provided: !!args.provided

      oplog "reports incorrect answer #{args.answer} for", 'puzzles', id, @userId, \
          'callins'
      # cancel any matching entries on the call-in queue for this puzzle
      for c in CallIns.find(target: id, answer: args.answer).fetch()
        Meteor.call 'cancelCallIn',
          id: c._id
          suppressLog: true
      return true

    deleteAnswer: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        target: IdOrObject
      id = args.target._id or args.target
      now = UTCNow()
      updateDoc = $set:
        solved: null
        solved_by: null
        touched: now
        touched_by: @userId
      deleteTagInternal updateDoc, 'answer'
      deleteTagInternal updateDoc, 'backsolve'
      deleteTagInternal updateDoc, 'provided'
      Puzzles.update id, updateDoc
      oplog "Deleted answer for", 'puzzles', id, @userId
      return true

    newPoll: (room, question, options) ->
      check @userId, NonEmptyString
      check room, NonEmptyString
      check question, NonEmptyString
      check options, ArrayWithLength(NonEmptyString, {min: 2, max: 5})
      canonOpts = new Set
      opts = for opt in options
        copt = canonical opt
        continue if canonOpts.has copt
        canonOpts.add copt
        {canon: copt, option: opt}
      id = Polls.insert
        created: UTCNow()
        created_by: @userId
        question: question
        options: opts
        votes: {}
      Meteor.call 'newMessage',
        body: question
        room_name: room
        poll: id
      id

    vote: (poll, option) ->
      check @userId, NonEmptyString
      check poll, NonEmptyString
      check option, NonEmptyString
      # This atomically checks that the poll exists and the option is valid,
      # then replaces any existing vote the user made.
      Polls.update
        _id: poll
        'options.canon': option
      ,
        $set: "votes.#{@userId}": {canon: option, timestamp: UTCNow()}

    getRinghuntersFolder: ->
      check @userId, NonEmptyString
      return unless Meteor.isServer
      # Return special folder used for uploads to general Ringhunters chat
      return share.drive.ringhuntersFolder

    # if a round/puzzle folder gets accidentally deleted, this can be used to
    # manually re-create it.
    fixPuzzleFolder: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        type: ValidType
        object: IdOrObject
        name: NonEmptyString
      id = args.object._id or args.object
      newDriveFolder id, args.name

    changeSetting: (setting, value) ->
      check @userId, NonEmptyString
      check setting, NonEmptyString
      check value, String
      0 < Settings.update canonical(setting), $set:
        value: value
        touched: UTCNow()
        touched_by: @userId
)()

UTCNow = -> Date.now()

# exports
share.model =
  # constants
  PRESENCE_KEEPALIVE_MINUTES: PRESENCE_KEEPALIVE_MINUTES
  NOT_A_TIMESTAMP: NOT_A_TIMESTAMP
  # collection types
  CallIns: CallIns
  Quips: Quips
  Polls: Polls
  Names: Names
  LastAnswer: LastAnswer
  Rounds: Rounds
  Puzzles: Puzzles
  Messages: Messages
  OldMessages: OldMessages
  Pages: Pages
  LastRead: LastRead
  Presence: Presence
  Settings: Settings
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
