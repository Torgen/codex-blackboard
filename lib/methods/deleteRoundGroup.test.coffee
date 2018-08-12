'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'deleteRoundGroup', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers(7)
    driveMethods =
      createPuzzle: sinon.fake.returns
        id: 'fid' # f for folder
        spreadId: 'sid'
        docId: 'did'
      renamePuzzle: sinon.spy()
      deletePuzzle: sinon.spy()
    if share.drive?
      sinon.stub(share, 'drive').value(driveMethods)
    else
      share.drive = driveMethods

  afterEach ->
    sinon.restore()

  beforeEach ->
    resetDatabase()

  describe 'when it is empty', ->
    id = null
    ret = null
    beforeEach ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: []
        incorrectAnswers: []
        tags: {}
      ret = Meteor.call 'deleteRoundGroup',
        id: id
        who: 'cjb'

    it 'returns true', ->
      chai.assert.isTrue ret

    it 'deletes the round group', ->
      chai.assert.isUndefined model.RoundGroups.findOne()
    
    it 'makes no drive calls', ->
      chai.assert.equal driveMethods.deletePuzzle.callCount, 0

    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'roundgroups', room_name: 'oplog/0'}).fetch(), 1

  describe 'when it contains rounds', ->
    id = null
    ret = null
    beforeEach ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['foo1', 'foo2']
        incorrectAnswers: []
        tags: {}
      ret = Meteor.call 'deleteRoundGroup',
        id: id
        who: 'cjb'
    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leads round group alone', ->
      chai.assert.isNotNull model.RoundGroups.findOne id

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'
