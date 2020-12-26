'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'renamePuzzle', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']
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
    clock.restore()
    sinon.restore()

  beforeEach ->
    resetDatabase()

  describe 'when new name is unique', ->
    id = null
    beforeEach ->
      id = model.Puzzles.insert
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
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: {}

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'renamePuzzle',
          id: id
          name: 'Bar'
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'renamePuzzle', 'cjb',
          id: id
          name: 'Bar'

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'renames puzzle', ->
        puzzle = model.Puzzles.findOne id
        chai.assert.include puzzle,
          name: 'Bar'
          canon: 'bar'
          touched: 7
          touched_by: 'cjb'
      
      it 'renames drive', ->
        chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']

      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1

  describe 'when puzzle with that name exists', ->
    id1 = null
    id2 = null
    ret = null
    beforeEach ->
      id1 = model.Puzzles.insert
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
      id2 = model.Puzzles.insert
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
      ret = callAs 'renamePuzzle', 'cjb',
        id: id1
        name: 'Bar'

    it 'returns false', ->
      chai.assert.isFalse ret

    it 'leaves puzzle unchanged', ->
      chai.assert.include model.Puzzles.findOne(id1),
        name: 'Foo'
        canon: 'foo'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'puzzles'}).fetch(), 0, 'oplogs'

    it 'doesn\'t rename drive', ->
      chai.assert.equal driveMethods.renamePuzzle.callCount, 0
