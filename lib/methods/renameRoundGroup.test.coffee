'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  describe 'when new name is unique', ->
    id = null
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
        rounds: ['yoy']
        incorrectAnswers: []
        tags: {}
    
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'renameRoundGroup',
          id: id
          name: 'Bar'
      , Match.Error
    
    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = Meteor.callAs 'renameRoundGroup', 'cjb',
          id: id
          name: 'Bar'

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'renames round group', ->
        group = model.RoundGroups.findOne id
        chai.assert.include group,
          name: 'Bar'
          canon: 'bar'
          touched: 7
          touched_by: 'cjb'
      
      it 'doesn\'t rename a drive', ->
        chai.assert.equal driveMethods.renamePuzzle.callCount, 0, 'rename drive calls'
      
      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

  describe 'when another round group has same name', ->
    id1 = null
    id2 = null
    ret = null
    beforeEach ->
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
        tags: {}
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
        tags: {}
      ret = Meteor.callAs 'renameRoundGroup', 'cjb',
        id: id1
        name: 'Bar'

    it 'returns false', ->
      chai.assert.isFalse ret
      
    it 'leaves round group alone', ->
      group = model.RoundGroups.findOne id1
      chai.assert.include group,
        name: 'Foo'
        canon: 'foo'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'roundgroups'}).fetch(), 0, 'oplogs'
