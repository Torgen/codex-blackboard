'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'puzzle method', ->
  driveStub = null
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers(7)
    driveMethods =
      createPuzzle: sinon.fake.returns
        driveId: 'fid' # f for folder
        spreadId: 'sid'
        docId: 'did'
      renamePuzzle = sinon.spy()
    driveStub = (if share.drive?
      sinon.stub share, 'drive'
    else
      sinon.stub()).value(driveMethods)

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

  it 'renameRound', ->
    id = 
  
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