'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newRoundGroup', ->
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
    
  it 'creates new round group', ->
    group = Meteor.call 'newRoundGroup',
      name: 'Foo'
      who: 'torgen'
      rounds: ['rd1']
    group = model.RoundGroups.findOne group._id
    chai.assert.deepInclude group,
      name: 'Foo'
      canon: 'foo'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      solved: null
      solved_by: null
      rounds: ['rd1']
      incorrectAnswers: []
      tags: []
    chai.assert.doesNotHaveAnyKeys group, ['drive', 'spreadsheet', 'doc', 'link']
    chai.assert.lengthOf model.Messages.find({id: group._id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

  it 'returns existing group of same name', ->
    id = model.RoundGroups.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      tags: []
      solved: null
      solved_by: null
      incorrectAnswers: []
      rounds: ['rd1', 'rd2']
    group = Meteor.call 'newRoundGroup',
      name: 'Foo'
      who: 'cjb'
    chai.assert.equal group._id, id
    chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 0, 'oplogs'