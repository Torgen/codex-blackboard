'use strict'

import { PRESENCE_KEEPALIVE_MINUTES } from '/lib/imports/constants.coffee'
import { BBCollection, CalendarEvents, Calendar, CallIns, LastRead, Messages, Names, Polls, Presence, Puzzles, Roles, Rounds, collection, pretty_collection } from '/lib/imports/collections.coffee'
import canonical from './imports/canonical.coffee'
import isDuplicateError from './imports/duplicate.coffee'
import { drive as driveEnv } from './imports/environment.coffee'
import { ArrayMembers, ArrayWithLength, EqualsString, NumberInRange, NonEmptyString, IdOrObject, ObjectWith, OptionalKWArg } from './imports/match.coffee'
import { IsMechanic } from './imports/mechanics.coffee'
import { getTag, isStuck, canonicalTags } from './imports/tags.coffee'
import { RoundUrlPrefix, PuzzleUrlPrefix, RoleRenewalTime, UrlSeparator } from './imports/settings.coffee'
import * as callin_types from './imports/callin_types.coffee'
if Meteor.isServer
  {newMessage, ensureDawnOfTime} = require('/server/imports/newMessage.coffee')
else
  newMessage = ->
  ensureDawnOfTime = ->
# Blackboard -- data model
# Loaded on both the client and the server

do ->
  # private helpers, not exported
  unimplemented = -> throw new Meteor.Error(500, "Unimplemented")

  # a key of BBCollection
  ValidType = Match.Where (x) ->
    check x, NonEmptyString
    Object::hasOwnProperty.call(BBCollection, x)
    
  oplog = (message, type, id, who, stream='') ->
    Messages.insert
      room_name: 'oplog/0'
      nick: canonical(who)
      timestamp: Date.now()
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
    now = Date.now()
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
    object._id = collection(type).insert object
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
    now = Date.now()

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
      condition: Match.Optional Object
    condition = args.condition ? {}
    name = collection(type).findOne(args.id)?.name
    return false unless name
    result = collection(type).remove {_id: args.id, ...condition}
    return false if result is 0
    unless options.suppressLog
      oplog "Deleted "+pretty_collection(type)+" "+name, \
          type, null, args.who
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
    res = null
    try
      res = driveEnv.get()?.createPuzzle(name) ? {}
      unless res?.id
        res.status = 'skipped'
    catch e
      res = status: 'failed'
      if e instanceof Error
        res.message = "#{e.name}: #{e.message}"
      else
        res.message = "#{e}"
    Puzzles.update id,
      $set:
        drive_status: res.status ? null
        drive_error_message: res.message
        drive: res.id
        spreadsheet: res.spreadId

  renameDriveFolder = (new_name, drive, spreadsheet) ->
    check new_name, NonEmptyString
    check drive, NonEmptyString
    check spreadsheet, Match.Optional(NonEmptyString)
    return unless Meteor.isServer
    driveEnv.get()?.renamePuzzle(new_name, drive, spreadsheet)

  deleteDriveFolder = (drive) ->
    check drive, NonEmptyString
    return unless Meteor.isServer
    driveEnv.get()?.deletePuzzle drive

  moveWithinParent = if Meteor.isServer
    require('/server/imports/move_within_parent.coffee').default
  else
    require('/client/imports/move_within_parent.coffee').default

  settableFields =
    callins:
      callin_type: OptionalKWArg callin_types.IsCallinType
      submitted_by: OptionalKWArg NonEmptyString
      submitted_to_hq: OptionalKWArg Boolean
    puzzles:
      link: OptionalKWArg String
      order_by: Match.Optional Match.OneOf(EqualsString(''), EqualsString('name'))
      
  Meteor.methods
    newRound: (args) ->
      check @userId, NonEmptyString
      round_prefix = RoundUrlPrefix.get()
      url_separator = UrlSeparator.get()
      link = if round_prefix
        round_prefix += '/' unless round_prefix.endsWith '/'
        "#{round_prefix}#{canonical(args.name, url_separator)}"
      r = newObject "rounds", {args..., who: @userId},
        puzzles: []
        link: args.link or link
        sort_key: Date.now()
      ensureDawnOfTime "rounds/#{r._id}"
      # This is an onduty action, so defer expiry
      Meteor.call 'renewOnduty'
      # TODO(torgen): create default meta
      r
    renameRound: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        id: NonEmptyString
        name: NonEmptyString
      renameObject "rounds", {args..., who: @userId}
      # TODO(torgen): rename default meta
    deleteRound: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      deleteObject "rounds", {id, who: @userId, condition: puzzles: $size: 0}

    newPuzzle: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        round: NonEmptyString
        feedsInto: Match.Optional [NonEmptyString]
        puzzles: Match.Optional [NonEmptyString]
        mechanics: Match.Optional [IsMechanic]
      throw new Meteor.Error(404, "bad round") unless Rounds.findOne(args.round)?
      puzzle_prefix = PuzzleUrlPrefix.get()
      url_separator = UrlSeparator.get()
      link = if puzzle_prefix
        puzzle_prefix += '/' unless puzzle_prefix.endsWith '/'
        "#{puzzle_prefix}#{canonical(args.name, url_separator)}"
      feedsInto = args.feedsInto or []
      extra =
        solved: null
        solved_by: null
        drive: args.drive or null
        spreadsheet: args.spreadsheet or null
        doc: args.doc or null
        link: args.link or link
        feedsInto: feedsInto
        drive_status: 'creating'
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
      Rounds.update args.round,
        $addToSet: puzzles: p._id
        $set:
          touched_by: p.touched_by
          touched: p.touched
      # create google drive folder (server only)
      newDriveFolder p._id, p.name
      # This is an onduty action, so defer expiry
      Meteor.call 'renewOnduty'
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
      result = renameObject "puzzles", {args..., who: @userId}
      # rename google drive folder
      renameDriveFolder args.name, drive, spreadsheet if result and drive?
      return result
    deletePuzzle: (pid) ->
      check @userId, NonEmptyString
      check pid, NonEmptyString
      # get drive ID (racy)
      old = Puzzles.findOne pid
      now = Date.now()
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
      # remove from events
      CalendarEvents.update { puzzle: pid },
        $unset: puzzle: ''
      , multi: true
      # delete google drive folder
      deleteDriveFolder drive if drive?
      # XXX: delete chat room logs?
      return r

    makeMeta: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      now = Date.now()
      # This only fails if, for some reason, puzzles is a list containing null.
      return 0 < Puzzles.update {_id: id, puzzles: null}, $set:
        puzzles: []
        touched: now
        touched_by: @userId

    makeNotMeta: (id) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      now = Date.now()
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
      now = Date.now()
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
      now = Date.now()
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
      callin = newObject "callins", {name:"#{args.callin_type}:#{name}:#{args.answer}", who:@userId},
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
      msg =
        action: true
        header_ignore: true
        on_behalf: true
      # send to the general chat
      msg.body = body(specifyPuzzle: true)
      unless args.suppressRoom is "general/0"
        Meteor.call 'newMessage', msg
      if puzzle?
        # send to the puzzle chat
        msg.body = body(specifyPuzzle: false)
        msg.room_name = "puzzles/#{id}"
        unless args.suppressRoom is msg.room_name
          Meteor.call 'newMessage', msg
        # send to the metapuzzle chat
        puzzle.feedsInto.forEach (meta) ->
          msg.body = body(specifyPuzzle: true)
          msg.room_name = "puzzles/#{meta}"
          unless args.suppressRoom is msg.room_name
            Meteor.call "newMessage", msg
      oplog "New #{args.callin_type} #{args.answer} submitted for", args.target_type, id, \
          @userId, 'callins'
      return callin

    # Response is forbibben for answers and optional for other callin types.
    correctCallIn: (id, response) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      msg =
        room_name: "#{callin.target_type}/#{callin.target}"
        action: true
        on_behalf: true
      puzzle = Puzzles.findOne(callin.target) if callin.target_type is 'puzzles'
      if callin.callin_type is callin_types.ANSWER
        check response, undefined
        # call-in is cancelled as a side-effect of setAnswer
        Meteor.call "setAnswer",
          target: callin.target
          answer: callin.answer
          backsolve: callin.backsolve
          provided: callin.provided
        if puzzle?
          backsolve = if callin.backsolve then "[backsolved] " else ''
          provided = if callin.provided then "[provided] " else ''
          Object.assign msg,
            body: "reports that #{provided}#{backsolve}#{callin.answer.toUpperCase()} is CORRECT!"
        else
          msg = null
      else
        check response, Match.Optional String
        updateBody =
          status: 'accepted'
          resolved: Date.now()
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

      if msg?

        # one message to the puzzle chat
        Meteor.call 'newMessage', msg

        # one message to the general chat
        delete msg.room_name
        msg.body += " (#{puzzle.name})" if puzzle?.name?
        Meteor.call 'newMessage', {msg..., header_ignore: true}

        if callin.callin_type is callin_types.ANSWER
          # one message to the each metapuzzle's chat
          puzzle.feedsInto.forEach (meta) ->
            msg.room_name = "puzzles/#{meta}"
            Meteor.call 'newMessage', msg
      # This is an onduty action, so defer expiry.
      Meteor.call 'renewOnduty'

    # Response is forbibben for answers and optional for everything else
    incorrectCallIn: (id, response) ->
      check @userId, NonEmptyString
      check id, NonEmptyString
      callin = CallIns.findOne id
      throw new Meteor.Error(400, "bad callin") unless callin
      msg =
        room_name: "#{callin.target_type}/#{callin.target}"
        action: true
        on_behalf: true
      puzzle = Puzzles.findOne(callin.target) if callin.target_type is 'puzzles'
      if callin.callin_type is callin_types.ANSWER
        check response, undefined
        # call-in is cancelled as a side-effect of addIncorrectAnswer
        Meteor.call "addIncorrectAnswer",
          target: callin.target
          answer: callin.answer
          backsolve: callin.backsolve
          provided: callin.provided
        if puzzle?
          Object.assign msg,
            body: "sadly relays that #{callin.answer.toUpperCase()} is INCORRECT."
        else
          msg = null
      else if callin.callin_type is callin_types.EXPECTED_CALLBACK
        throw new Meteor.Error(400, 'expected callback can\'t be incorrect')
      else
        check response, Match.Optional String
        updateBody =
          status: 'rejected'
          resolved: Date.now()
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

      if msg?
        # one message to the puzzle chat
        Meteor.call 'newMessage', msg

        if puzzle?
          # one message to the general chat
          delete msg.room_name
          msg.body += " (#{puzzle.name})" if puzzle.name?
          Meteor.call 'newMessage', {msg..., header_ignore: true}
          puzzle.feedsInto.forEach (meta) ->
            msg.room_name = "puzzles/#{meta}"
            Meteor.call 'newMessage', msg
        
      # This is an onduty action, so defer expiry.
      Meteor.call 'renewOnduty'

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
          resolved: Date.now()
    
    claimOnduty: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        from: OptionalKWArg NonEmptyString
      now = Date.now()
      try
        res = Roles.upsert {_id: 'onduty', holder: args.from },
          holder: @userId
          claimed_at: now
          renewed_at: now
          expires_at: now + RoleRenewalTime.get() * 60000
        if res.insertedId?
          # Nobody was onduty
          oplog 'is now', 'roles', 'onduty', @userId, 'onduty'
        else
          # Took it from who you thought
          oplog "took over from @#{args.from} as", 'roles', 'onduty', @userId, 'onduty'
      catch e
        if isDuplicateError e
          current = Roles.findOne 'onduty'
          if args.from?
            throw new Meteor.Error 412, "Tried to take onduty from #{args.from} but it was held by #{current.holder}"
          else
            throw new  Meteor.Error 412, "Tried to claim vacant onduty but it was held by #{current.holder}"
        else throw e

    renewOnduty: ->
      check @userId, NonEmptyString
      now = Date.now()
      count = Roles.update {_id: 'onduty', holder: @userId},
        $set:
          renewed_at: now
          expires_at: now + RoleRenewalTime.get() * 60000
      return count isnt 0

    releaseOnduty: ->
      check @userId, NonEmptyString
      count = Roles.remove {_id: 'onduty', holder: @userId}
      if count isnt 0
        oplog 'is no longer onduty', 'roles', null, @userId, 'onduty'
      return count isnt 0

    # locateNick is in /server/methods

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
      num = Messages.update (
        _id: id
        to: null
        system: $in: [false, null]
        action: $in: [false, null]
        oplog: $in: [false, null]
        presence: null
      ), $set: {starred: starred or null}
      if starred and num > 0
        # If it's in general chat, announce it if it hasn't been announced before
        Messages.update
          _id: id
          room_name: 'general/0'
          announced_at: null
        , $set:
          announced_at: Date.now()
          announced_by: @userId
      return num

    updateLastRead: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        room_name: NonEmptyString
        timestamp: Number
      query = 
        nick: @userId
        room_name: args.room_name
      if @isSimulation
        query._id = args.room_name
      LastRead.upsert query, $max: timestamp: args.timestamp

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
      console.log args
      check @userId, NonEmptyString
      check args, ObjectWith
        type: ValidType
        object: IdOrObject
        fields: settableFields[args.type]
      id = args.object._id or args.object
      now = Date.now()
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
      args.now = Date.now() # don't let caller lie about the time
      updateDoc = $set:
        touched: args.now
        touched_by: @userId
      id = args.object._id or args.object
      setTagInternal updateDoc, {args..., who: @userId}
      0 < collection(args.type).update id, updateDoc

    renameTag: ({type, object, old_name, new_name}) ->
      check @userId, NonEmptyString
      check type, ValidType
      check object, IdOrObject
      check old_name, NonEmptyString
      check new_name, NonEmptyString
      new_canon = canonical new_name
      throw new Match.Error 'Can\'t rename to link' if new_canon is 'link'
      old_canon = canonical old_name
      now = Date.now()
      coll = collection(type)
      id = object._id or object
      if new_canon is old_canon
        # change 'name' but do nothing else
        ct = coll.update {
          _id: id
          "tags.#{old_canon}": $exists: true
        }, {
          $set:
            "tags.#{new_canon}.name": new_name
            "tags.#{new_canon}.touched": now
            "tags.#{new_canon}.touched_by": @userId
            touched: now
            touched_by: @userId
        }
        if 1 isnt ct
          throw new Meteor.Error 404, "No such object"
        return 
      if @isSimulation
        # this is all synchronous
        ct = coll.update {
          _id: id
          "tags.#{old_canon}": $exists: true
          "tags.#{new_canon}": $exists: false
        }, {
          $set:
            "tags.#{new_canon}.name": new_name
            "tags.#{new_canon}.touched": now
            "tags.#{new_canon}.touched_by": @userId
            touched: now
            touched_by: @userId
          $rename:
            "tags.#{old_canon}.value": "tags.#{new_canon}.value"
        }
        if ct is 1
          coll.update {_id: id}, {$unset: "tags.#{old_canon}": ''}
        else 
          throw new Meteor.Error 404, "No such object"
        return
      # On the server, use aggregation pipeline to make the whole edit in a single
      # call to avoid a race condition. This requires rawCollection because the
      # wrappers don't support aggregation pipelines.
      result = Promise.await(coll.rawCollection().updateOne({
        _id: id
        "tags.#{old_canon}": $exists: true
        "tags.#{new_canon}": $exists: false
      }, [{
        $addFields: {
          "tags.#{new_canon}": {
            value: "$tags.#{old_canon}.value"
            name: $literal: new_name
            touched: now
            touched_by: $literal: @userId
          }
          touched: now
          touched_by: $literal: @userId
        }},
        {$unset: "tags.#{old_canon}" }
      ]))
      if 1 is result.modifiedCount
        # Since we used rawCollection, we Have to trigger subscription update manually.
        Meteor.refresh {collection: type, id}
      else
        throw new Meteor.Error 404, "No such object"

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
      args.now = Date.now() # don't let caller lie about the time
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
        now: Date.now()
      if isStuck obj
        return
      oplog "Help requested for", 'puzzles', id, @userId, 'stuck'
      body = "has requested help: #{rawhow}"
      Meteor.call 'newMessage',
        action: true
        body: body
        room_name: "puzzles/#{id}"
        on_behalf: true
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
        header_ignore: true
        on_behalf: true
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
        now: Date.now()
      body = "has arrived to help"
      if @userId is sticker
        body = "no longer needs help getting unstuck"
      Meteor.call 'newMessage',
        action: true
        body: body
        room_name: "puzzles/#{id}"
        on_behalf: true
      body = "#{body} in puzzle #{obj.name}"
      Meteor.call 'newMessage',
        action: true
        body: body
        header_ignore: true
        on_behalf: true
      return

    getRoundForPuzzle: (puzzle) ->
      check @userId, NonEmptyString
      check puzzle, IdOrObject
      id = puzzle._id or puzzle
      check id, NonEmptyString
      return Rounds.findOne(puzzles: id)

    moveWithinMeta: (id, parentId, args) ->
      check @userId, NonEmptyString
      check args, Match.OneOf ObjectWith(pos: Number), ObjectWith(before: NonEmptyString), ObjectWith(after: NonEmptyString)
      args.who = @userId
      moveWithinParent id, 'puzzles', parentId, args

    moveWithinRound: (id, parentId, args) ->
      check @userId, NonEmptyString
      check args, Match.OneOf ObjectWith(pos: Number), ObjectWith(before: NonEmptyString), ObjectWith(after: NonEmptyString)
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
      now = Date.now()
      # Accumulate solver time for currrent presence
      solverTime = 0
      Presence.find({scope: 'chat', room_name: "puzzles/#{id}", bot: $ne: true}).forEach (present) ->
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
      now = Date.now()

      target = Puzzles.findOne(id)
      throw new Meteor.Error(400, "bad target") unless target

      oplog "reports incorrect answer #{args.answer} for", 'puzzles', id, @userId, 'callins'
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
      now = Date.now()
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
          touched: Date.now()
          touched_by: @userId
      throw new Meteor.Error(404, "bad puzzle") unless num > 0

    removeMechanic: (puzzle, mechanic) ->
      check @userId, NonEmptyString
      check puzzle, NonEmptyString
      check mechanic, IsMechanic
      num = Puzzles.update puzzle,
        $pull: mechanics: mechanic
        $set:
          touched: Date.now()
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
        created: Date.now()
        created_by: @userId
        question: question
        options: opts
        votes: {}
      newMessage
        nick: @userId
        body: question
        room_name: room
        poll: id
        on_behalf: true
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
        $set: "votes.#{@userId}": {canon: option, timestamp: Date.now()}

    setPuzzleForEvent: (event, puzzle) ->
      check @userId, NonEmptyString
      check event, NonEmptyString
      check puzzle, Match.Maybe(NonEmptyString)
      update = if puzzle?
        check Puzzles.findOne(_id: puzzle), Object
        $set: {puzzle}
      else
        $unset: puzzle: ''
      return 0 < CalendarEvents.update {_id: event}, update

    addEventAttendee: (event, who) ->
      check @userId, NonEmptyString
      check event, NonEmptyString
      check Meteor.users.findOne(_id: who), Object
      return 0 < CalendarEvents.update {_id: event}, $addToSet: attendees: who

    removeEventAttendee: (event, who) ->
      check @userId, NonEmptyString
      check event, NonEmptyString
      check Meteor.users.findOne(_id: who), Object
      return 0 < CalendarEvents.update {_id: event}, $pull: attendees: who

    getRinghuntersFolder: ->
      check @userId, NonEmptyString
      return unless Meteor.isServer
      # Return special folder used for uploads to general Ringhunters chat
      return driveEnv.get()?.ringhuntersFolder

    # if a round/puzzle folder gets accidentally deleted, this can be used to
    # manually re-create it.
    fixPuzzleFolder: (args) ->
      check @userId, NonEmptyString
      check args, ObjectWith
        object: IdOrObject
        name: NonEmptyString
      id = args.object._id or args.object
      if 0 is Puzzles.update {_id: id, drive_status: $nin: ['creating', 'fixing']}, $set: drive_status: 'fixing'
        throw new Meteor.Error 'Can\'t fix this puzzle folder now'
      newDriveFolder id, args.name
      # This is an onduty action, so defer expiry
      Meteor.call 'renewOnduty'
