'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'newRoundGroup',
        name: 'Foo'
        rounds: ['rd1']
    , Match.Error

  describe 'when none exists with that name', ->
    id = null
    beforeEach ->
      id = Meteor.callAs 'newRoundGroup', 'torgen',
        name: 'Foo'
        rounds: ['rd1']
      ._id

    it 'creates new round group', ->
      group = model.RoundGroups.findOne id 
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
        tags: {}
    
    it 'has no drive', ->
      group = model.RoundGroups.findOne id 
      chai.assert.doesNotHaveAnyKeys group, ['drive', 'spreadsheet', 'doc', 'link']
    
    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

  describe 'when one has that name', ->
    id = null
    group = null
    beforeEach ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        tags: {}
        solved: null
        solved_by: null
        incorrectAnswers: []
        rounds: ['rd1', 'rd2']
      group = Meteor.callAs 'newRoundGroup', 'cjb',
        name: 'Foo'
        
    it 'returns the existing group', ->
      chai.assert.equal group._id, id
    
    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 0, 'oplogs'
