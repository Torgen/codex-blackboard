'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'puzzle method', ->
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
    # Round is created, then drive et al are added
    round = model.Rounds.findOne round._id
    chai.assert.deepInclude round,
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
    chai.assert.lengthOf model.Rounds.find(round._id).fetch(), 1, 'round created'
    chai.assert.lengthOf model.Messages.find({id: round._id, type: 'rounds'}).fetch(), 1, 'oplogs'

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
    chai.assert.include round,
      name: 'Bar'
      canon: 'bar'
      touched: 7
      touched_by: 'cjb'
    chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']
    chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 1, 'oplogs'
  
  describe 'newPuzzle', ->
    it 'creates puzzle', ->
      puzzle = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'torgen'
        link: 'https://puzzlehunt.mit.edu/foo'
      # Puzzle is created, then drive et al are added.
      puzzle = model.Puzzles.findOne puzzle._id
      chai.assert.deepInclude puzzle,
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
      chai.assert.lengthOf model.Puzzles.find(puzzle._id).fetch(), 1, 'puzzle created'
      chai.assert.lengthOf model.Messages.find({id: puzzle._id, type: 'puzzles'}).fetch(), 1, 'oplogs'
    
    it 'returns existing puzzle of same name', ->
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
      p = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'cjb'
      chai.assert.equal p, id
      chai.assert.include p,
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'

  describe 'renamePuzzle', ->
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
