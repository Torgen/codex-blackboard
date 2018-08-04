'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'renameRoundGroup', ->
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

  it 'renames round group', ->
    id = model.RoundGroups.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      rounds: ['yoy']
      incorrectAnswers: []
      tags: []
    chai.assert.isTrue Meteor.call 'renameRoundGroup',
      id: id
      name: 'Bar'
      who: 'cjb'
    group = model.RoundGroups.findOne id
    chai.assert.include group,
      name: 'Bar'
      canon: 'bar'
      touched: 7
      touched_by: 'cjb'
    chai.assert.equal driveMethods.renamePuzzle.callCount, 0, 'rename drive calls'
    chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

  it 'doesn\'t clobber round group with same name', ->
    id1 = model.RoundGroups.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      incorrectAnswers: []
      tags: []
    id2 = model.RoundGroups.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cscott'
      touched: 2
      touched_by: 'cscott'
      solved: null
      solved_by: null
      incorrectAnswers: []
      tags: []
    chai.assert.isFalse Meteor.call 'renameRoundGroup',
      id: id1
      name: 'Bar'
      who: 'cjb'
    chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'roundgroups'}).fetch(), 0, 'oplogs'
  