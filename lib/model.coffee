'use strict'

import canonical from './imports/canonical.coffee'
import { ArrayMembers, ArrayWithLength, EqualsString, NumberInRange, NonEmptyString, IdOrObject, ObjectWith } from './imports/match.coffee'
import { IsMechanic } from './imports/mechanics.coffee'
import { getTag, isStuck, canonicalTags } from './imports/tags.coffee'
import { RoundUrlPrefix, PuzzleUrlPrefix } from './imports/settings.coffee'
import * as callin_types from './imports/callin_types.coffee'
if Meteor.isServer
  {newMessage, ensureDawnOfTime} = require('/server/imports/newMessage.coffee')
else
  newMessage = ->
  ensureDawnOfTime = ->
# Blackboard -- data model
# Loaded on both the client and the server

# how often we send keep alive presence messages.  increase/decrease to adjust
# client/server load.
PRESENCE_KEEPALIVE_MINUTES = 2

# this is used to yield "zero results" in collections which index by timestamp
NOT_A_TIMESTAMP = -9999

randomname = if Meteor.isServer
  (s) -> require('../server/imports/randomname.coffee').default(seed: s)
else
  (s) -> s.slice(0, 16)

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
#   favorites: object whose keys are userids of users who favorited this
#              puzzle. Values are true. On the client, either empty or contains
#              only you.
#   mechanics: list of canonical forms of mechanic names from
#              ./imports/mechanics.coffee.
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
# If you add fields to this that should be visible on the client, also add them
# to the fields map in puzzleQuery in server/server.coffee.
Puzzles = BBCollection.puzzles = new Mongo.Collection "puzzles"
if Meteor.isServer
  Puzzles._ensureIndex {canon: 1}, {unique:true, dropDups:true}
  Puzzles._ensureIndex {feedsInto: 1}
  Puzzles._ensureIndex {puzzles: 1}
  Puzzles._ensureIndex {solved: 1}, {partialFilterExpression: solved: $exists: true}

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
CallIns = BBCollection.callins = new Mongo.Collection "callins"
if Meteor.isServer
  CallIns._ensureIndex {status: 1, created: 1}
  CallIns._ensureIndex {status: 1, target_type: 1, target: 1, callin_type: 1, answer: 1}, {unique:true, dropDups:true, partialFilterExpression: {status: 'pending'}}
  CallIns._ensureIndex {target_type: 1, target: 1, created: 1}

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
#   favorite_mechanics: list of favorite mechanics in canonical form.
#     Only served to yourself.
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
#   dawn_of_time: boolean. True for the first message in each channel, which
#                 also has _id equal to the channel name.
#   deleted: boolean. True if message was deleted. 'Deleted' messages aren't
#            actually deleted because that could screw up the 'last read' line;
#            they're just not rendered.
#
# Messages which are part of the operation log have `nick`, `message`,
# and `timestamp` set to describe what was done, when, and by who.
# They have `system=false`, `action=true`, `oplog=true`, `to=null`,
# and `room_name="oplog/0"`.  They also have three additional fields:
# `type` and `id`, which give a mongodb reference to the object
# modified so we can hyperlink to it, and stream, which maps to the
# JS Notification API 'tag' for deduping and selective muting.
Messages = BBCollection.messages = new Mongo.Collection "messages"
if Meteor.isServer
  Messages._ensureIndex {to:1, room_name:1, timestamp:-1}, {}
  Messages._ensureIndex {nick:1, room_name:1, timestamp:-1}, {}
  Messages._ensureIndex {room_name:1, timestamp:-1}, {}
  Messages._ensureIndex {room_name:1, starred: -1, timestamp: 1},
    partialFilterExpression: starred: true
  Messages._ensureIndex {timestamp: 1}, {}

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
#   bot: true if this is a bot user. Used to ignore bot presence for
#        aggregating solver minutes spent on a puzzle.
Presence = BBCollection.presence = new Mongo.Collection "presence"
if Meteor.isServer
  Presence._ensureIndex {nick: 1, room_name:1}, {unique:true, dropDups:true}
  Presence._ensureIndex {timestamp:-1}, {}
  Presence._ensureIndex {present:1, room_name:1}, {}

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
        return false if npos > npuzzles.length
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
      round_prefix = RoundUrlPrefix.get()
      link = if round_prefix
        round_prefix += '/' unless round_prefix.endsWith '/'
        "#{round_prefix}#{canonical(args.name)}"
      r = newObject "rounds", {args..., who: @userId},
        puzzles: []
        link: args.link or link
        sort_key: UTCNow()
      ensureDawnOfTime "rounds/#{r._id}"
      # TODO(torgen): create default meta
      r
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
        mechanics: Match.Optional [IsMechanic]
      throw new Meteor.Error(404, "bad round") unless Rounds.findOne(args.round)?
      puzzle_prefix = PuzzleUrlPrefix.get()
      link = if puzzle_prefix
        puzzle_prefix += '/' unless puzzle_prefix.endsWith '/'
        "#{puzzle_prefix}#{canonical(args.name)}"
      feedsInto = args.feedsInto or []
      extra =
        solved: null
        solved_by: null
        drive: args.drive or null
        spreadsheet: args.spreadsheet or null
        doc: args.doc or null
        link: args.link or link
        feedsInto: feedsInto
      if args.puzzles?
        extra.puzzles = args.puzzles
      if args.mechanics?
        extra.mechanics = [new Set(args.mechanics)...]
      p = newObject "puzzles", {args..., who: @userId}, extra
      ensureDawnOfTime "puzzles/#{p._id}"
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
      return if this.isSimulation # otherwise we trigger callin sound twice
      args.callin_type ?= callin_types.ANSWER
      args.target_type ?= 'puzzles'
      puzzle = null
      body = -> ''
      if args.callin_type is callin_types.ANSWER
        check args,
          target: IdOrObject
          target_type: EqualsString 'puzzles'
          answer: NonEmptyString
          callin_type: EqualsString callin_types.ANSWER
          backsolve: Match.Optional Boolean
          provided: Match.Optional Boolean
          suppressRoom: Match.Optional String
        puzzle = Puzzles.findOne(args.target)
        throw new Meteor.Error(404, "bad target") unless puzzle?
        name = puzzle.name
        backsolve = if args.backsolve then " [backsolved]" else ''
        provided = if args.provided then " [provided]" else ''
        body = (opts) ->
          "is requesting a call-in for #{args.answer.toUpperCase()}" + \
          (if opts?.specifyPuzzle then " (#{name})" else "") + provided + backsolve
      else
        check args,
          target: IdOrObject
          target_type: EqualsString 'puzzles'
          answer: NonEmptyString
          callin_type: Match.OneOf(
            EqualsString(callin_types.INTERACTION_REQUEST),
            EqualsString(callin_types.MESSAGE_TO_HQ),
            EqualsString(callin_types.EXPECTED_CALLBACK))
          suppressRoom: Match.Optional String
        puzzle = Puzzles.findOne(args.target)
        throw new Meteor.Error(404, "bad target") unless puzzle?
        name = puzzle.name
        description = switch args.callin_type
          when callin_types.INTERACTION_REQUEST
            'is requesting the interaction'
          when callin_types.MESSAGE_TO_HQ
            'wants to tell HQ'
          when callin_types.EXPECTED_CALLBACK
            'expects HQ to call back for'
        body = (opts) ->
          "#{description}, \"#{args.answer.toUpperCase()}\"" + \
          (if opts?.specifyPuzzle then " (#{name})" else "")
      id = args.target._id or args.target
      newObject "callins", {name:"#{args.callin_type}:#{name}:#{args.answer}", who:@userId},
        callin_type: args.callin_type
        target: id
        target_type: args.target_type
        answer: args.answer
        who: @userId
        submitted_to_hq: false
        backsolve: !!args.backsolve
        provided: !!args.provided
        status: 'pending'
      , {suppressLog:true}
      msg = action: true
      # send to the general chat
      msg.body = body(specifyPuzzle: true)
      unless args?.suppressRoom is "general/0"
        Meteor.call 'newMessage', msg
      if puzzle?
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
      oplog "New #{args.callin_type} #{args.answer} submitted for", args.target_type, id, \
          @userId, 'callins'

    newQuip: (text) ->
      check @userId, NonEmptyString
      check text, NonEmptyString
      # "Name" of a quip is a random name based on its hash, so the
      # oplogs don't spoil the quips.
      name = randomname(text)
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

    # Response is forbibben for answers and optional for other callin types.
    correctCallIn: (id, response) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      msg =
        room_name: "#{callin.target_type}/#{callin.target}"
        action: true
      puzzle = Puzzles.findOne(callin.target) if callin.target_type is 'puzzles'
      if callin.callin_type is callin_types.ANSWER
        check response, undefined
        # call-in is cancelled as a side-effect of setAnswer
        Meteor.call "setAnswer",
          target: callin.target
          answer: callin.answer
          backsolve: callin.backsolve
          provided: callin.provided
        backsolve = if callin.backsolve then "[backsolved] " else ''
        provided = if callin.provided then "[provided] " else ''
        return unless puzzle?
        Object.assign msg,
          body: "reports that #{provided}#{backsolve}#{callin.answer.toUpperCase()} is CORRECT!"
      else
        check response, Match.Optional String
        updateBody =
          status: 'accepted'
          resolved: UTCNow()
        extra = if response?
          updateBody.response = response
          " with response \"#{response}\""
        else
          ''
        type_text = if callin.callin_type is callin_types.MESSAGE_TO_HQ
          'message to HQ'
        else callin.callin_type
        verb = if callin.callin_type is callin_types.EXPECTED_CALLBACK
          'RECEIVED'
        else 'ACCEPTED'

        Object.assign msg,
          body: "reports that the #{type_text} \"#{callin.answer}\" was #{verb}#{extra}!"
        CallIns.update _id: id,
          $set: updateBody

      # one message to the puzzle chat
      Meteor.call 'newMessage', msg

      # one message to the general chat
      delete msg.room_name
      msg.body += " (#{puzzle.name})" if puzzle?.name?
      Meteor.call 'newMessage', msg

      if callin.callin_type is callin_types.ANSWER
        # one message to the each metapuzzle's chat
        puzzle.feedsInto.forEach (meta) ->
          msg.room_name = "puzzles/#{meta}"
          Meteor.call 'newMessage', msg

    # Response is optional for interaction requests and forbibben for answers.
    incorrectCallIn: (id, response) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      msg =
        room_name: "#{callin.target_type}/#{callin.target}"
        action: true
      puzzle = Puzzles.findOne(callin.target) if callin.target_type is 'puzzles'
      if callin.callin_type is callin_types.ANSWER
        check response, undefined
        # call-in is cancelled as a side-effect of addIncorrectAnswer
        Meteor.call "addIncorrectAnswer",
          target: callin.target
          answer: callin.answer
          backsolve: callin.backsolve
          provided: callin.provided
        return unless puzzle?
        Object.assign msg,
          body: "sadly relays that #{callin.answer.toUpperCase()} is INCORRECT."
      else if callin.callin_type is callin_types.EXPECTED_CALLBACK
        throw new Meteor.Error(400, 'expected callback can\'t be incorrect')
      else
        check response, Match.Optional String
        updateBody =
          status: 'rejected'
          resolved: UTCNow()
        extra = if response?
          updateBody.response = response
          " with response \"#{response}\""
        else
          ''
        type_text = if callin.callin_type is callin_types.MESSAGE_TO_HQ
          'message to HQ'
        else callin.callin_type

        Object.assign msg,
          body: "sadly relays that the #{type_text} \"#{callin.answer}\" was REJECTED#{extra}."
        CallIns.update _id: id,
          $set: updateBody

      # one message to the puzzle chat
      Meteor.call 'newMessage', msg

      return unless puzzle?

      # one message to the general chat
      delete msg.room_name
      msg.body += " (#{puzzle.name})" if puzzle.name?
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
      CallIns.update _id: args.id, status: 'pending',
        $set:
          status: 'cancelled'
          resolved: UTCNow()

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

    favoriteMechanic: (mechanic) ->
      check @userId, NonEmptyString
      check mechanic, IsMechanic
      n = Meteor.users.update @userId, $addToSet: favorite_mechanics: mechanic
      throw new Meteor.Error(400, "bad userId: #{@userId}") unless n > 0

    unfavoriteMechanic: (mechanic) ->
      check @userId, NonEmptyString
      check mechanic, IsMechanic
      n = Meteor.users.update @userId, $pull: favorite_mechanics: mechanic
      throw new Meteor.Error(400, "bad userId: #{@userId}") unless n > 0

    announce: (body) ->
      check @userId, NonEmptyString
      check body, NonEmptyString
      oplog body, null, null, @userId, 'announcements'

    newMessage: (args) ->
      check @userId, NonEmptyString
      check args,
        body: Match.Optional String
        bodyIsHtml: Match.Optional Boolean
        action: Match.Optional Boolean
        to: Match.Optional NonEmptyString
        room_name: Match.Optional NonEmptyString
        useful: Match.Optional Boolean
        bot_ignore: Match.Optional Boolean
        suppressLastRead: Match.Optional Boolean
      return if this.isSimulation # suppress flicker
      suppress = args.suppressLastRead
      delete args.suppressLastRead
      newMsg = {args..., nick: @userId}
      newMsg.body ?= ''
      newMsg.room_name ?= "general/0"
      newMsg = newMessage newMsg
      # update the user's 'last read' message to include this one
      # (doing it here allows us to use server timestamp on message)
      unless suppress
        Meteor.call 'updateLastRead',
          room_name: newMsg.room_name
          timestamp: newMsg.timestamp
      newMsg

    deleteMessage: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      Messages.update
        _id: id
        dawn_of_time: $ne: true
      ,
        $set: deleted: true

    setStarred: (id, starred) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      check starred, Boolean
      Messages.update (
        _id: id
        to: null
        system: $in: [false, null]
        action: $in: [false, null]
        oplog: $in: [false, null]
        presence: null
      ), $set: {starred: starred or null}

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
        bot: Match.Optional Boolean
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
      set_doc =
        present: args.present or false
      if args.bot
        set_doc.bot = true
      if args.present and args.foreground
        set_doc.foreground = true
        set_doc.foreground_uuid = args.uuid

      Presence.upsert
        nick: @userId
        room_name: args.room_name
      ,
        $max:
          timestamp: UTCNow()
        $set: set_doc
      return unless args.present
      # only set foreground if true or foreground_uuid matches; this
      # prevents bouncing if user has two tabs open, and one is foregrounded
      # and the other is not.
      unless args.foreground # only update 'foreground' if uuid matches
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
               'tags','puzzles', 'feedsInto',
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
      name = canonical(args.name)
      # bail to deleteAnswer if this is the 'answer' tag.
      if name is 'answer'
        return Meteor.call "deleteAnswer",
          type: args.type
          target: args.object
      if name is 'link'
        args.fields = { link: null }
        return Meteor.call 'setField', args
      args.now = UTCNow() # don't let caller lie about the time
      updateDoc = $set:
        touched: args.now
        touched_by: @userId
      deleteTagInternal updateDoc, name
      0 < collection(args.type).update {_id: id, "tags.#{name}": $exists: true}, updateDoc

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
      solverTimePart = if obj.solverTime?
        "; #{Math.floor(obj.solverTime / 60000)} solver-minutes"
      else ''
      body = "has requested help: #{UI._escape rawhow} (puzzle <a class=\"puzzles-link\" href=\"#{objUrl}\">#{UI._escape obj.name}</a>#{solverTimePart})"
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
      # Accumulate solver time for currrent presence
      solverTime = 0
      Presence.find({present: true, room_name: "puzzles/#{id}", bot: $ne: true}).forEach (present) ->
        since = now - present.timestamp
        if since < (PRESENCE_KEEPALIVE_MINUTES*60+10)*1000
          # If it's been less than one keepalive interval, plus some skew, since you checked in, assume you're still here
          solverTime += since
        else
          # On average you left halfway through the keepalive period.
          solverTime += since - PRESENCE_KEEPALIVE_MINUTES*30*1000

      updateDoc =
        $set:
          solved: now
          solved_by: @userId
          confirmed_by: @userId
          touched: now
          touched_by: @userId
        $inc:
          solverTime: solverTime
      c = CallIns.findOne(target: id, callin_type: callin_types.ANSWER, answer: args.answer)
      if c?
        updateDoc.$set.solved_by = c.created_by
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
      CallIns.update {target_type: 'puzzles', target: id, status: 'pending', callin_type: callin_types.ANSWER, answer: args.answer},
        $set:
          status: 'accepted'
          resolved: now
      CallIns.update {target_type: 'puzzles', target: id, status: 'pending'},
        $set:
          status: 'cancelled'
          resolved: now
      ,
        multi: true
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

      oplog "reports incorrect answer #{args.answer} for", 'puzzles', id, @userId, \
          'callins'
      # cancel any matching entries on the call-in queue for this puzzle
      # The 'pending' status means this should be unique if present.
      CallIns.update {target_type: 'puzzles', callin_type: callin_types.ANSWER, target: id, status: 'pending', answer: args.answer},
        $set:
          status: 'rejected'
          resolved: now
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
        confirmed_by: null
        touched: now
        touched_by: @userId
      deleteTagInternal updateDoc, 'answer'
      deleteTagInternal updateDoc, 'backsolve'
      deleteTagInternal updateDoc, 'provided'
      Puzzles.update id, updateDoc
      oplog "Deleted answer for", 'puzzles', id, @userId
      return true

    favorite: (puzzle) ->
      check @userId, NonEmptyString
      check puzzle, NonEmptyString
      num = Puzzles.update puzzle, $set:
        "favorites.#{@userId}": true
      num > 0

    unfavorite: (puzzle) ->
      check @userId, NonEmptyString
      check puzzle, NonEmptyString
      num = Puzzles.update puzzle, $unset:
        "favorites.#{@userId}": ''
      num > 0

    addMechanic: (puzzle, mechanic) ->
      check @userId, NonEmptyString
      check puzzle, NonEmptyString
      check mechanic, IsMechanic
      num = Puzzles.update puzzle,
        $addToSet: mechanics: mechanic
        $set:
          touched: UTCNow()
          touched_by: @userId
      throw new Meteor.Error(404, "bad puzzle") unless num > 0

    removeMechanic: (puzzle, mechanic) ->
      check @userId, NonEmptyString
      check puzzle, NonEmptyString
      check mechanic, IsMechanic
      num = Puzzles.update puzzle,
        $pull: mechanics: mechanic
        $set:
          touched: UTCNow()
          touched_by: @userId
      throw new Meteor.Error(404, "bad puzzle") unless num > 0

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
      newMessage
        nick: @userId
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
