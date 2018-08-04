'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'deletePuzzle', ->
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
    
  it 'deletes puzzle', ->
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
      tags: []
      drive: 'ffoo'
      spreadsheet: 'sfoo'
      doc: 'dfoo'
    rid = model.Rounds.insert
      name: 'Bar'
      canon: 'bar'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: [id, 'another_puzzle']
      incorrectAnswers: []
      tags: []
    chai.assert.isTrue Meteor.call 'deletePuzzle',
      id: id
      who: 'cjb'
    chai.assert.isUndefined model.Puzzles.findOne(), 'no puzzles after deletion'
    chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'puzzles', room_name: 'oplog/0'}).fetch(), 1, 'oplogs'
    chai.assert.deepEqual model.Rounds.findOne(rid),
      _id: rid
      name: 'Bar'
      canon: 'bar'
      created: 1
      created_by: 'torgen'
      # Removing puzzle doesn't count as touching, apparently.
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: ['another_puzzle']
      incorrectAnswers: []
      tags: []
    chai.assert.deepEqual driveMethods.deletePuzzle.getCall(0).args, ['ffoo']
