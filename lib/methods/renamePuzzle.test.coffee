'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'renamePuzzle', ->
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

  it 'renames puzzle', ->
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
      tags: []
    chai.assert.isTrue Meteor.call 'renamePuzzle',
      id: id
      name: 'Bar'
      who: 'cjb'
    puzzle = model.Puzzles.findOne id
    chai.assert.include puzzle,
      name: 'Bar'
      canon: 'bar'
      touched: 7
      touched_by: 'cjb'
    chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']
    chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1, 'oplogs'

  it 'doesn\'t clobber puzzle with same name', ->
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
      tags: []
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
      tags: []
    chai.assert.isFalse Meteor.call 'renamePuzzle',
      id: id1
      name: 'Bar'
      who: 'cjb'
    chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'puzzles'}).fetch(), 0, 'oplogs'
    chai.assert.equal driveMethods.renamePuzzle.callCount, 0, 'rename calls'
