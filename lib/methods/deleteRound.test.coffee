'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'deleteRound', ->
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
    rgid = null
    ret = null
    beforeEach ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: []
        incorrectAnswers: []
        tags: []
        drive: 'ffoo'
        spreadsheet: 'sfoo'
        doc: 'dfoo'
      rgid = model.RoundGroups.insert
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: [id, 'another_round']
        incorrectAnswers: []
        tags: []
      ret = Meteor.call 'deleteRound',
        id: id
        who: 'cjb'

    it 'returns true', ->
       chai.assert.isTrue ret

    it 'deletes the round', ->
      chai.assert.isUndefined model.Rounds.findOne(), 'no rounds after deletion'

    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'rounds', room_name: 'oplog/0'}).fetch(), 1

    it 'removes round from round group', ->
      chai.assert.deepEqual model.RoundGroups.findOne(rgid),
        _id: rgid
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        # Removing round doesn't count as touching, apparently.
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['another_round']
        incorrectAnswers: []
        tags: []

    it 'deletes drive', ->
      chai.assert.deepEqual driveMethods.deletePuzzle.getCall(0).args, ['ffoo']

  describe 'when round isn\'t empty', ->
    id = null
    ret = null
    beforeEach ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['foo1', 'foo2']
        incorrectAnswers: []
        tags: []
      ret = Meteor.call 'deleteRound',
        id: id
        who: 'cjb'
    
    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves round', ->
      chai.assert.isNotNull model.Rounds.findOne id

    it 'leaves drive', ->
      chai.assert.equal driveMethods.deletePuzzle.callCount, 0
    
    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'
