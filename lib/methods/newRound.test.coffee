'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newRound', ->
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

  it 'creates new round', ->
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

  it 'returns existing round of same name', ->
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
    r = Meteor.call 'newRound',
      name: 'Foo'
      who: 'cjb'
    chai.assert.equal r._id, id
    chai.assert.include r,
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
    chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 0, 'oplogs'