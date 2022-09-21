'use strict'

# For side effects
import '/lib/model.coffee'
import { Messages, Rounds } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'deleteRound', ->
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()
    sinon.restore()

  beforeEach ->
    resetDatabase()

  describe 'when it is empty', ->
    id = null
    beforeEach ->
      id = Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: []
        tags: {}

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'deleteRound', id
      , Match.Error
    
    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'deleteRound', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'deletes the round', ->
        chai.assert.isUndefined Rounds.findOne(), 'no rounds after deletion'

  describe 'when round isn\'t empty', ->
    id = null
    ret = null
    beforeEach ->
      id = Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['foo1', 'foo2']
        tags: {}
      ret = callAs 'deleteRound', 'cjb', id
    
    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves round', ->
      chai.assert.isNotNull Rounds.findOne id
    
    it 'doesn\'t oplog', ->
      chai.assert.lengthOf Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'
