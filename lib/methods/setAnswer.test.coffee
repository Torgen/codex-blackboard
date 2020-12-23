'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setAnswer', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'without answer', ->
    id = null
    ret = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: null
        solved_by: null
        confirmed_by: null
        solverTime: 14
        tags: technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'torgen'
        timestamp: 2
        present: true
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'botto'
        timestamp: 0
        bot: true
        present: true
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'idle'
        timestamp: -130001
        present: true
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'setAnswer',
          target: id
          answer: 'bar'
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'setAnswer', 'cjb',
          target: id
          answer: 'bar'

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'modifies document', ->
        chai.assert.deepEqual model.Puzzles.findOne(id),
          _id: id
          name: 'Foo'
          canon: 'foo'
          created: 1
          created_by: 'cscott'
          touched: 7
          touched_by: 'cjb'
          solved: 7
          solved_by: 'cjb'
          confirmed_by: 'cjb'
          solverTime: 70027
          tags:
            answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
            technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      
      it 'oplogs', ->
        oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
        chai.assert.equal oplogs.length, 1
        chai.assert.include oplogs[0],
          nick: 'cjb'
          timestamp: 7
          type: 'puzzles'
          id: id
          oplog: true
          action: true
          stream: 'answers'

  describe 'with answer', ->
    id = null
    ret = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: 2
        solved_by: 'cscott'
        confirmed_by: 'torgen'
        solverTime: 0
        tags:
          answer: {name: 'Answer', value: 'qux', touched: 2, touched_by: 'torgen'}
          technology:{name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      ret = callAs 'setAnswer', 'cjb',
        target: id
        answer: 'bar'
    
    it 'returns true', ->
      chai.assert.isTrue ret

    it 'modifies document', ->
      chai.assert.deepEqual model.Puzzles.findOne(id),
        _id: id
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 7
        touched_by: 'cjb'
        solved: 7
        solved_by: 'cjb'
        confirmed_by: 'cjb'
        solverTime: 0
        tags:
          answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
          technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
    
    it 'oplogs', ->
      oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
      chai.assert.equal oplogs.length, 1
      chai.assert.include oplogs[0],
        nick: 'cjb'
        timestamp: 7
        bodyIsHtml: false
        type: 'puzzles'
        id: id
        oplog: true
        action: true
        stream: 'answers'

  describe 'with same answer', ->
    id = null
    ret = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: 2
        solved_by: 'cscott'
        confirmed_by: 'torgen'
        solverTime: 14
        tags:
          answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'}
          technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'torgen'
        timestamp: 2
        present: true
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'botto'
        timestamp: 0
        bot: true
        present: true
      model.Presence.insert
        room_name: "puzzles/#{id}"
        nick: 'idle'
        timestamp: -130001
        present: true
      ret = callAs 'setAnswer', 'cjb',
        target: id
        answer: 'bar'

    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves document alone', ->
      chai.assert.deepEqual model.Puzzles.findOne(id),
        _id: id
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: 2
        solved_by: 'cscott'
        confirmed_by: 'torgen'
        solverTime: 14
        tags:
          answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'}
          technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0

  it 'modifies tags', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 2
      touched_by: 'torgen'
      solved: null
      solved_by: null
      confirmed_by: null
      tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    chai.assert.isTrue callAs 'setAnswer', 'cjb',
      target: id
      answer: 'bar'
      backsolve: true
      provided: true
    chai.assert.deepInclude model.Puzzles.findOne(id),
      tags:
        answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
        backsolve: {name: 'Backsolve', value: 'yes', touched: 7, touched_by: 'cjb'}
        provided: {name: 'Provided', value: 'yes', touched: 7, touched_by: 'cjb'}

  describe 'with matching callins', ->
    id = null
    cid1 = null
    cid2 = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: null
        solved_by: null
        confirmed_by: null
        tags: {}
      cid1 = model.CallIns.insert
        target_type: 'puzzles'
        target: id
        name: 'Foo'
        answer: 'bar'
        callin_type: 'answer'
        created: 5
        created_by: 'codexbot'
        submitted_to_hq: true
        backsolve: false
        provided: false
        status: 'pending'
      cid2 = model.CallIns.insert
        target_type: 'puzzles'
        target: id
        name: 'Foo'
        answer: 'qux'
        callin_type: 'answer'
        created: 5
        created_by: 'codexbot'
        submitted_to_hq: false
        backsolve: false
        provided: false
        status: 'pending'
      callAs 'setAnswer', 'cjb',
        target: id
        answer: 'bar'
        
    it 'updates callins', ->
      chai.assert.include model.CallIns.findOne(cid1),
        status: 'accepted'
      chai.assert.include model.CallIns.findOne(cid2),
        status: 'cancelled'

    it 'doesn\'t oplog for callins', ->
      chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: 'callins'}).fetch(), 0

    it 'oplogs for puzzle', ->
      chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: 'puzzles', id: id}).fetch(), 1

    it 'sets solved_by correctly', ->
      chai.assert.deepInclude model.Puzzles.findOne(id),
        solved: 7
        solved_by: 'codexbot'
        confirmed_by: 'cjb'
