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

  it 'deletes empty round group', ->
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
      tags: []
    chai.assert.isTrue Meteor.call 'deleteRoundGroup',
      id: id
      who: 'cjb'
    chai.assert.isUndefined model.RoundGroups.findOne(), 'no round groups after deletion'
    chai.assert.equal driveMethods.deletePuzzle.callCount, 0, 'delete drive calls'
    chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'roundgroups', room_name: 'oplog/0'}).fetch(), 1, 'oplogs'

  it 'doesn\'t delete non-empty round group', ->
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
      tags: []
    chai.assert.isFalse Meteor.call 'deleteRoundGroup',
      id: id
      who: 'cjb'
    chai.assert.isNotNull model.RoundGroups.findOne id
    chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'