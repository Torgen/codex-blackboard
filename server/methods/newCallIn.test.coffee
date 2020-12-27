'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newCallIn', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'of answer', ->

    it 'fails when target doesn\'t exist', ->
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: 'something'
          answer: 'precipitate'
      , Meteor.Error

    it 'fails when target is not a puzzle', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        puzzles: []
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: id
          target_type: 'rounds'
          answer: 'precipitate'
      , Match.Error

    describe 'on puzzle which exists', ->
      id = null
      beforeEach ->
        id = model.Puzzles.insert
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

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'newCallIn',
            target: id
            answer: 'precipitate'
        , Match.Error

      it 'fails without answer', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
        , Match.Error

      describe 'with simple callin', ->
        beforeEach ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'

        it 'creates document', ->
          c = model.CallIns.findOne()
          chai.assert.include c,
            name: 'answer:Foo:precipitate'
            target: id
            target_type: 'puzzles'
            answer: 'precipitate'
            callin_type: 'answer'
            who: 'torgen'
            submitted_to_hq: false
            backsolve: false
            provided: false
            status: 'pending'

        it 'oplogs', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            type: 'puzzles'
            id: id
            stream: 'callins'
            nick: 'torgen'
          # oplog is lowercase
          chai.assert.include o[0].body, 'precipitate', 'message'

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{id}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, 'PRECIPITATE', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, 'PRECIPITATE', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'
    
      it 'sets backsolve', ->
        callAs 'newCallIn', 'torgen',
          target: id
          answer: 'precipitate'
          backsolve: true
        c = model.CallIns.findOne()
        chai.assert.include c,
          target: id
          answer: 'precipitate'
          who: 'torgen'
          submitted_to_hq: false
          backsolve: true
          provided: false
          status: 'pending'
      
      it 'sets provided', ->
        callAs 'newCallIn', 'torgen',
          target: id
          answer: 'precipitate'
          provided: true
        c = model.CallIns.findOne()
        chai.assert.include c,
          target: id
          answer: 'precipitate'
          who: 'torgen'
          submitted_to_hq: false
          backsolve: false
          provided: true
          status: 'pending'

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
        tags: {}
        feedsInto: []
      p = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        feedsInto: [meta]
      model.Puzzles.update meta, $push: puzzles: p
      r = model.Rounds.insert
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'cjb'
        touched: 2
        touched_by: 'cscott'
        puzzles: [meta, p]
        tags: {}
      callAs 'newCallIn', 'torgen',
        target: p
        answer: 'precipitate'
      m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf m, 1
      chai.assert.include m[0],
        nick: 'torgen'
        action: true
      chai.assert.include m[0].body, 'PRECIPITATE'
      chai.assert.include m[0].body, '(Foo)'

  describe 'of interaction request', ->

    it 'fails when target doesn\'t exist', ->
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: 'something'
          answer: 'precipitate'
          callin_type: 'interaction request'
      , Meteor.Error

    it 'fails when target is not a puzzle', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        puzzles: []
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: id
          target_type: 'rounds'
          answer: 'precipitate'
          callin_type: 'interaction request'
      , Match.Error

    describe 'on puzzle which exists', ->
      id = null
      beforeEach ->
        id = model.Puzzles.insert
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

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'newCallIn',
            target: id
            answer: 'precipitate'
            callin_type: 'interaction request'
        , Match.Error

      it 'fails without answer', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            callin_type: 'interaction request'
        , Match.Error
    
      it 'fails with backsolve', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'interaction request'
            backsolve: true
        , Match.Error
      
      it 'fails with provided', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'interaction request'
            provided: true
        , Match.Error

      describe 'with valid parameters', ->
        beforeEach ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'pay the cat tax'
            callin_type: 'interaction request'

        it 'creates document', ->
          c = model.CallIns.findOne()
          chai.assert.include c,
            name: 'interaction request:Foo:pay the cat tax'
            target: id
            target_type: 'puzzles'
            answer: 'pay the cat tax'
            callin_type: 'interaction request'
            who: 'torgen'
            submitted_to_hq: false
            status: 'pending'

        it 'oplogs', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            type: 'puzzles'
            id: id
            stream: 'callins'
            nick: 'torgen'
          # oplog is lowercase
          chai.assert.include o[0].body, 'pay the cat tax', 'message'

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{id}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, 'PAY THE CAT TAX', 'message'
          chai.assert.include o[0].body, 'interaction', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, 'PAY THE CAT TAX', 'message'
          chai.assert.include o[0].body, 'interaction', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'

  describe 'of hq contact', ->

    it 'fails when target doesn\'t exist', ->
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: 'something'
          answer: 'precipitate'
          callin_type: 'message to hq'
      , Meteor.Error

    it 'fails when target is not a puzzle', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        puzzles: []
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: id
          target_type: 'rounds'
          answer: 'precipitate'
          callin_type: 'message to hq'
      , Match.Error

    describe 'on puzzle which exists', ->
      id = null
      beforeEach ->
        id = model.Puzzles.insert
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

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'newCallIn',
            target: id
            answer: 'precipitate'
            callin_type: 'message to hq'
        , Match.Error

      it 'fails without answer', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            callin_type: 'message to hq'
        , Match.Error
    
      it 'fails with backsolve', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'message to hq'
            backsolve: true
        , Match.Error
      
      it 'fails with provided', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'message to hq'
            provided: true
        , Match.Error

      describe 'with valid parameters', ->
        beforeEach ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'pay the cat tax'
            callin_type: 'message to hq'

        it 'creates document', ->
          c = model.CallIns.findOne()
          chai.assert.include c,
            name: 'message to hq:Foo:pay the cat tax'
            target: id
            target_type: 'puzzles'
            answer: 'pay the cat tax'
            callin_type: 'message to hq'
            who: 'torgen'
            submitted_to_hq: false
            status: 'pending'

        it 'oplogs', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            type: 'puzzles'
            id: id
            stream: 'callins'
            nick: 'torgen'
          # oplog is lowercase
          chai.assert.include o[0].body, 'pay the cat tax', 'message'

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{id}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, '"PAY THE CAT TAX"', 'message'
          chai.assert.include o[0].body, 'tell HQ', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, '"PAY THE CAT TAX"', 'message'
          chai.assert.include o[0].body, 'tell HQ', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'
  
  describe 'of expected callback', ->

    it 'fails when target doesn\'t exist', ->
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: 'something'
          answer: 'precipitate'
          callin_type: 'expected callback'
      , Meteor.Error

    it 'fails when target is not a puzzle', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        puzzles: []
      chai.assert.throws ->
        callAs 'newCallIn', 'torgen',
          target: id
          target_type: 'rounds'
          answer: 'precipitate'
          callin_type: 'expected callback'
      , Match.Error

    describe 'on puzzle which exists', ->
      id = null
      beforeEach ->
        id = model.Puzzles.insert
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

      it 'fails without login', ->
        chai.assert.throws ->
          Meteor.call 'newCallIn',
            target: id
            answer: 'precipitate'
            callin_type: 'expected callback'
        , Match.Error

      it 'fails without answer', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            callin_type: 'expected callback'
        , Match.Error
    
      it 'fails with backsolve', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'expected callback'
            backsolve: true
        , Match.Error
      
      it 'fails with provided', ->
        chai.assert.throws ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'precipitate'
            callin_type: 'expected callback'
            provided: true
        , Match.Error

      describe 'with valid parameters', ->
        beforeEach ->
          callAs 'newCallIn', 'torgen',
            target: id
            answer: 'pay the cat tax'
            callin_type: 'expected callback'

        it 'creates document', ->
          c = model.CallIns.findOne()
          chai.assert.include c,
            name: 'expected callback:Foo:pay the cat tax'
            target: id
            target_type: 'puzzles'
            answer: 'pay the cat tax'
            callin_type: 'expected callback'
            who: 'torgen'
            submitted_to_hq: false
            status: 'pending'

        it 'oplogs', ->
          o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            type: 'puzzles'
            id: id
            stream: 'callins'
            nick: 'torgen'
          # oplog is lowercase
          chai.assert.include o[0].body, 'pay the cat tax', 'message'

        it 'notifies puzzle chat', ->
          o = model.Messages.find(room_name: "puzzles/#{id}", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, '"PAY THE CAT TAX"', 'message'
          chai.assert.include o[0].body, 'expects HQ to call back', 'message'
          chai.assert.notInclude o[0].body, '(Foo)', 'message'

        it 'notifies general chat', ->
          o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
          chai.assert.lengthOf o, 1
          chai.assert.include o[0],
            nick: 'torgen'
            action: true
          chai.assert.include o[0].body, '"PAY THE CAT TAX"', 'message'
          chai.assert.include o[0].body, 'expects HQ to call back', 'message'
          chai.assert.include o[0].body, '(Foo)', 'message'
