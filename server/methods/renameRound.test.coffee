'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'renameRound', ->
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
    
  describe 'when new name is unique', ->
    id = null
    beforeEach ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        puzzles: ['yoy']
        link: 'https://puzzlehunt.mit.edu/foo'
        tags: {}
        
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'renameRound',
          id: id
          name: 'Bar'
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'renameRound', 'cjb',
          id: id
          name: 'Bar'
    
      it 'returns true', ->
        chai.assert.isTrue ret

      it 'renames round', ->
        round = model.Rounds.findOne id
        chai.assert.include round,
          name: 'Bar'
          canon: 'bar'
          touched: 7
          touched_by: 'cjb'

      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 1, 'oplogs'

  describe 'when a round exists with that name', ->
    id1 = null
    id2 = null
    ret = null
    beforeEach ->
      id1 = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        link: 'https://puzzlehunt.mit.edu/foo'
        tags: {}
      id2 = model.Rounds.insert
        name: 'Bar'
        canon: 'bar'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        link: 'https://puzzlehunt.mit.edu/foo'
        tags: {}
      ret = callAs 'renameRound', 'cjb',
        id: id1
        name: 'Bar'

    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves round alone', ->
      chai.assert.include model.Rounds.findOne(id1),
        name: 'Foo'
        canon: 'foo'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'rounds'}).fetch(), 0
