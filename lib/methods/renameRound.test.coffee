'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'renameRound', ->
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
        puzzles: ['yoy']
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: {}
      ret = Meteor.call 'renameRound',
        id: id
        name: 'Bar'
        who: 'cjb'
    
    it 'returns true', ->
      chai.assert.isTrue ret

    it 'renames round', ->
      round = model.Rounds.findOne id
      chai.assert.include round,
        name: 'Bar'
        canon: 'bar'
        touched: 7
        touched_by: 'cjb'

    it 'renames drive', ->
      chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']

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
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f1'
        spreadsheet: 's1'
        doc: 'd1'
        tags: {}
      id2 = model.Rounds.insert
        name: 'Bar'
        canon: 'bar'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f2'
        spreadsheet: 's2'
        doc: 'd2'
        tags: {}
      ret = Meteor.call 'renameRound',
        id: id1
        name: 'Bar'
        who: 'cjb'

    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves round alone', ->
      chai.assert.include model.Rounds.findOne(id1),
        name: 'Foo'
        canon: 'foo'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t rename drive', ->
      chai.assert.equal driveMethods.renamePuzzle.callCount, 0, 'rename calls'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'rounds'}).fetch(), 0
