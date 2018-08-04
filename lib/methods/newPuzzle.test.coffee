'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newPuzzle', ->
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
    chai.assert.equal p._id, id
    chai.assert.include p,
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
    chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 0, 'oplogs'
