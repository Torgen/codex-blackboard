'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'incorrectCallIn', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  puzzle = null
  callin = null

  describe 'on answer', ->
    beforeEach ->
      puzzle = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        callin_type: 'answer'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'incorrectCallIn', callin
      , Match.Error

    describe 'when logged in', ->
      beforeEach ->
        callAs 'incorrectCallIn', 'cjb', callin

      it 'updates callin', ->
        c = model.CallIns.findOne callin
        chai.assert.include c,
          status: 'rejected'

      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle, stream: 'callins'}).fetch(), 1

      it "notifies puzzle chat", ->
        chai.assert.lengthOf model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch(), 1

      it "notifies general chat", ->
        chai.assert.lengthOf model.Messages.find(room_name: 'general/0', dawn_of_time: $ne: true).fetch(), 1
  
  describe 'on interaction request', ->
    beforeEach ->
      puzzle = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        callin_type: 'interaction request'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'

    describe 'without response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin
        , Match.Error

      describe 'when logged in', ->
        beforeEach ->
          callAs 'incorrectCallIn', 'cjb', callin

        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'rejected'

        it 'does not add incorrectAnswer', ->
          chai.assert.isUndefined model.Puzzles.findOne(puzzle).incorrectAnswers

        it 'does not oplog', ->
          chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle, stream: 'callins'}).fetch(), 0

        it "notifies puzzle chat", ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it "notifies general chat", ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

    describe 'with response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin, 'sediment'
        , Match.Error

      describe 'when logged in', ->
        beforeEach ->
          callAs 'incorrectCallIn', 'cjb', callin, 'sediment'

        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'rejected'
            response: 'sediment'

        it 'does not add incorrectAnswer', ->
          chai.assert.isUndefined model.Puzzles.findOne(puzzle).incorrectAnswers

        it 'does not oplog', ->
          chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle, stream: 'callins'}).fetch(), 0

        it "notifies puzzle chat", ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, 'sediment', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it "notifies general chat", ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, 'sediment', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

  describe 'on message to hq', ->
    beforeEach ->
      puzzle = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        callin_type: 'message to hq'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'

    describe 'without response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin
        , Match.Error

      describe 'when logged in', ->
        beforeEach ->
          callAs 'incorrectCallIn', 'cjb', callin

        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'rejected'

        it 'does not add incorrectAnswer', ->
          chai.assert.isUndefined model.Puzzles.findOne(puzzle).incorrectAnswers

        it 'does not oplog', ->
          chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle, stream: 'callins'}).fetch(), 0

        it "notifies puzzle chat", ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it "notifies general chat", ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

    describe 'with response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin, 'sediment'
        , Match.Error

      describe 'when logged in', ->
        beforeEach ->
          callAs 'incorrectCallIn', 'cjb', callin, 'sediment'

        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'rejected'
            response: 'sediment'

        it 'does not add incorrectAnswer', ->
          chai.assert.isUndefined model.Puzzles.findOne(puzzle).incorrectAnswers

        it 'does not oplog', ->
          chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle, stream: 'callins'}).fetch(), 0

        it "notifies puzzle chat", ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, 'sediment', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it "notifies general chat", ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'REJECTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, 'sediment', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'
  
  describe 'on expected callback', ->
    beforeEach ->
      puzzle = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        callin_type: 'expected callback'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'

    describe 'without response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin
        , Match.Error

      it 'fails when logged in', ->
        chai.assert.throws ->
          callAs 'incorrectCallIn', 'cjb', callin
        , Meteor.Error

    describe 'with response', ->

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'incorrectCallIn', callin, 'sediment'
        , Match.Error

      it 'fails when logged in', ->
        chai.assert.throws ->
          callAs 'incorrectCallIn', 'cjb', callin, 'sediment'
        , Meteor.Error
