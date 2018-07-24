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
    driveMethods = {}
    driveStub = sinon.stub(share, 'drive').value(driveMethods)

  afterEach ->
    sinon.restore()

  beforeEach ->
    resetDatabase()
  
  it 'newRound', ->
    driveMethods.createPuzzle = sinon.fake.returns
      driveId: 'fid' # f for folder
      spreadId: 'sid'
      docId: 'did'
    id = Meteor.call 'newRound',
      name: 'Foo'
      who: 'torgen'
      link: 'https://puzzlehunt.mit.edu/foo'
    doc = model.Rounds.findOne id
    chai.assert.deepEquals doc,
      _id: id
      name: 'Foo'
      canon: 'foo'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: []
      incorrectAnswers: []
      link: 'https://puzzlehunt.mit.edu/foo'
      drive: 'fid'
      spreadsheet: 'sid'
      doc: 'did'
      tags: []