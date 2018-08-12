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
    
  describe 'when none exists with that name', ->
    id = null
    beforeEach ->
      id = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'torgen'
        link: 'https://puzzlehunt.mit.edu/foo'
      ._id

    it 'creates puzzle', ->
      chai.assert.deepInclude model.Puzzles.findOne(id),
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
        tags: {}
    
    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1

  describe 'when one exists with that name', ->
    id1 = null
    id2 = null
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
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: {}
      id2 = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'cjb'
      ._id
    
    it 'returns existing puzzle', ->
      chai.assert.equal id1, id2

    it 'doesn\'t touch', ->
      chai.assert.include model.Puzzles.findOne(id1),
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: id1, type: 'puzzles'}).fetch(), 0
