'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'correctCallIn', ->
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
  describe 'for answer', ->
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
        confirmed_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        callin_type: 'answer'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'
    
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'correctCallIn', callin
      , Match.Error
    
    it 'fails with response', ->
      chai.assert.throws ->
        callAs 'correctCallIn', 'cjb', callin, 'close enough'
      , Match.Error

    describe 'when logged in', ->
      beforeEach ->
        callAs 'correctCallIn', 'cjb', callin

      it 'updates puzzle', ->
        doc = model.Puzzles.findOne puzzle
        chai.assert.deepInclude doc,
          touched: 7
          touched_by: 'cjb'
          solved: 7
          solved_by: 'torgen'
          confirmed_by: 'cjb'
          tags: answer:
            name: 'Answer'
            value: 'precipitate'
            touched: 7
            touched_by: 'cjb'
      
      it 'updates callin', ->
        c = model.CallIns.findOne callin
        chai.assert.include c,
          status: 'accepted'

      it 'oplogs', ->
        o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          type: 'puzzles'
          id: puzzle
          stream: 'answers'
          nick: 'cjb'
        chai.assert.include o[0].body, '(PRECIPITATE)', 'message'

      it 'notifies puzzle chat', ->
        o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'

    it 'notifies meta chat for puzzle', ->
      meta = model.Puzzles.insert
        name: 'Meta'
        canon: 'meta'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        confirmed_by: null
        tags: {}
        incorrectAnswers: []
        feedsInto: []
        puzzles: [puzzle]
      model.Puzzles.update puzzle, $push: feedsInto: meta
      callAs 'correctCallIn', 'cjb', callin
      m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf m, 1
      chai.assert.include m[0],
        nick: 'cjb'
        action: true
      chai.assert.include m[0].body, 'PRECIPITATE'
      chai.assert.include m[0].body, '(Foo)'

  describe 'for interaction request', ->
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
        confirmed_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        callin_type: 'interaction request'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'
    
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'correctCallIn', callin
      , Match.Error

    describe 'when logged in', ->
      describe 'without response', ->
        beforeEach ->
          callAs 'correctCallIn', 'cjb', callin

        it 'does not update puzzle', ->
          doc = model.Puzzles.findOne puzzle
          chai.assert.deepInclude doc,
            touched: 1
            touched_by: 'cscott'
            solved: null
            solved_by: null
            confirmed_by: null
            tags: {}
        
        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'accepted'

        it 'does not oplog', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 0

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'ACCEPTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

    describe 'with response', ->
      beforeEach ->
        callAs 'correctCallIn', 'cjb', callin, 'Make us some supersaturated Kool-Aid'

      it 'does not update puzzle', ->
        doc = model.Puzzles.findOne puzzle
        chai.assert.deepInclude doc,
          touched: 1
          touched_by: 'cscott'
          solved: null
          solved_by: null
          confirmed_by: null
          tags: {}
      
      it 'updates callin', ->
        c = model.CallIns.findOne callin
        chai.assert.include c,
          status: 'accepted'
          response: 'Make us some supersaturated Kool-Aid'

      it 'does not oplog', ->
        o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 0

      it 'notifies puzzle chat', ->
        o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'ACCEPTED', 'message'
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'

    it 'does not notify meta chat for puzzle', ->
      meta = model.Puzzles.insert
        name: 'Meta'
        canon: 'meta'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        confirmed_by: null
        tags: {}
        incorrectAnswers: []
        feedsInto: []
        puzzles: [puzzle]
      model.Puzzles.update puzzle, $push: feedsInto: meta
      callAs 'correctCallIn', 'cjb', callin
      m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf m, 0
      
  describe 'for message to HQ', ->
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
        confirmed_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        callin_type: 'message to hq'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
    
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'correctCallIn', callin
      , Match.Error

    describe 'when logged in', ->
      describe 'without response', ->
        beforeEach ->
          callAs 'correctCallIn', 'cjb', callin

        it 'does not update puzzle', ->
          doc = model.Puzzles.findOne puzzle
          chai.assert.deepInclude doc,
            touched: 1
            touched_by: 'cscott'
            solved: null
            solved_by: null
            confirmed_by: null
            tags: {}
        
        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'accepted'

        it 'does not oplog', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 0

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'ACCEPTED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

    describe 'with response', ->
      beforeEach ->
        callAs 'correctCallIn', 'cjb', callin, 'Make us some supersaturated Kool-Aid'

      it 'does not update puzzle', ->
        doc = model.Puzzles.findOne puzzle
        chai.assert.deepInclude doc,
          touched: 1
          touched_by: 'cscott'
          solved: null
          solved_by: null
          confirmed_by: null
          tags: {}
      
      it 'updates callin', ->
        c = model.CallIns.findOne callin
        chai.assert.include c,
          status: 'accepted'
          response: 'Make us some supersaturated Kool-Aid'

      it 'does not oplog', ->
        o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 0

      it 'notifies puzzle chat', ->
        o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'ACCEPTED', 'message'
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'

    it 'does not notify meta chat for puzzle', ->
      meta = model.Puzzles.insert
        name: 'Meta'
        canon: 'meta'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        confirmed_by: null
        tags: {}
        incorrectAnswers: []
        feedsInto: []
        puzzles: [puzzle]
      model.Puzzles.update puzzle, $push: feedsInto: meta
      callAs 'correctCallIn', 'cjb', callin
      m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf m, 0

  describe 'for expected callback', ->
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
        confirmed_by: null
        tags: {}
        feedsInto: []
      callin = model.CallIns.insert
        name: 'Foo:precipitate'
        callin_type: 'expected callback'
        target: puzzle
        target_type: 'puzzles'
        answer: 'precipitate'
        created: 2
        created_by: 'torgen'
        submitted_to_hq: true
        backsolve: false
        provided: false
    
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'correctCallIn', callin
      , Match.Error

    describe 'when logged in', ->
      describe 'without response', ->
        beforeEach ->
          callAs 'correctCallIn', 'cjb', callin

        it 'does not update puzzle', ->
          doc = model.Puzzles.findOne puzzle
          chai.assert.deepInclude doc,
            touched: 1
            touched_by: 'cscott'
            solved: null
            solved_by: null
            confirmed_by: null
            tags: {}
        
        it 'updates callin', ->
          c = model.CallIns.findOne callin
          chai.assert.include c,
            status: 'accepted'

        it 'does not oplog', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 0

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'RECEIVED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'cjb'
            action: true
          chai.assert.include o[0].body, 'RECEIVED', 'message'
          chai.assert.include o[0].body, '"precipitate"', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

    describe 'with response', ->
      beforeEach ->
        callAs 'correctCallIn', 'cjb', callin, 'Make us some supersaturated Kool-Aid'

      it 'does not update puzzle', ->
        doc = model.Puzzles.findOne puzzle
        chai.assert.deepInclude doc,
          touched: 1
          touched_by: 'cscott'
          solved: null
          solved_by: null
          confirmed_by: null
          tags: {}
      
      it 'updates callin', ->
        c = model.CallIns.findOne callin
        chai.assert.include c,
          status: 'accepted'
          response: 'Make us some supersaturated Kool-Aid'

      it 'does not oplog', ->
        o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 0

      it 'notifies puzzle chat', ->
        o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'RECEIVED', 'message'
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'RECEIVED', 'message'
        chai.assert.include o[0].body, '"precipitate"', 'message'
        chai.assert.include o[0].body, 'Make us some supersaturated Kool-Aid', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'

    it 'does not notify meta chat for puzzle', ->
      meta = model.Puzzles.insert
        name: 'Meta'
        canon: 'meta'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        confirmed_by: null
        tags: {}
        incorrectAnswers: []
        feedsInto: []
        puzzles: [puzzle]
      model.Puzzles.update puzzle, $push: feedsInto: meta
      callAs 'correctCallIn', 'cjb', callin
      m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf m, 0