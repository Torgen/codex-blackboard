'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'puzzle method', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers(7)
    driveMethods =
      createPuzzle: sinon.fake.returns
        driveId: 'fid' # f for folder
        spreadId: 'sid'
        docId: 'did'
      renamePuzzle: sinon.spy()
    if share.drive?
      sinon.stub(share, 'drive').value(driveMethods)
    else
      share.drive = driveMethods

  afterEach ->
    sinon.restore()

  beforeEach ->
    resetDatabase()
  
  it 'newRound', ->
    round = Meteor.call 'newRound',
      name: 'Foo'
      who: 'torgen'
      link: 'https://puzzlehunt.mit.edu/foo'
      puzzles: ['yoy']
    chai.assert.includes round,
      name: 'Foo'
      canon: 'foo'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: ['yoy']
      incorrectAnswers: []
      link: 'https://puzzlehunt.mit.edu/foo'
      drive: 'fid'
      spreadsheet: 'sid'
      doc: 'did'
      tags: []
    chai.assert.lengthOf model.Rounds.find(round._id).fetch(), 1
    # TODO(torgen): check oplog

  it 'renameRound', ->
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
      tags: []
    chai.assert.isTrue Meteor.call 'renameRound',
      id: id
      name: 'Bar'
      who: 'cjb'
    round = model.Rounds.findOne id
    chai.assert.includes round,
      name: 'Bar'
      canon: 'bar'
      touched: 7
      touched_by: 'cjb'
    chai.assert.equal driveMethods.renamePuzzle.callCount, 1
    chai.assert.equal driveMethods.renamePuzzle.withArgs(id, 'fid', 'sid', 'did').callCount, 1
    # TODO(torgen): check oplog
  
  it 'newPuzzle', ->
    puzzle = Meteor.call 'newPuzzle',
      name: 'Foo'
      who: 'torgen'
      link: 'https://puzzlehunt.mit.edu/foo'
    chai.assert.includes puzzle,
      name: 'Foo'
      canon: 'foo'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      solved: null
      solved_by: null
      incorrectAnswers: []
      link: 'https://puzzlehunt.mit.edu/foo'
      drive: 'fid'
      spreadsheet: 'sid'
      doc: 'did'
      tags: []
    chai.assert.lengthOf model.Puzzles.find(puzzle._id).fetch(), 1
    # TODO(torgen): check oplog

  it 'renamePuzzle', ->
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
    chai.assert.includes puzzle,
      name: 'Bar'
      canon: 'bar'
      touched: 7
      touched_by: 'cjb'
    chai.assert.equal driveMethods.renamePuzzle.callCount, 1
    chai.assert.equal driveMethods.renamePuzzle.withArgs(id, 'fid', 'sid', 'did').callCount, 1
    # TODO(torgen): check oplog