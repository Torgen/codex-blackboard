'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'newPuzzle',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
    , Match.Error
    
  describe 'when none exists with that name', ->
    round = null
    id = null
    beforeEach ->
      round = model.Rounds.insert
        name: 'Round'
        canon: 'round'
        created: 1
        created_by: 'cjb'
        touched: 1
        touched_by: 'cjb'
        puzzles: []
      id = Meteor.callAs 'newPuzzle', 'torgen',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
        round: round
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

    it 'adds puzzle to round', ->
      chai.assert.deepInclude model.Rounds.findOne(round),
        touched: 7
        touched_by: 'torgen'
        puzzles: [id]
    
    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1

  it 'derives link', ->
    model.Settings.insert
      _id: 'puzzle_url_prefix'
      value: 'https://testhuntpleaseign.org/puzzles'
    round = model.Rounds.insert
      name: 'Round'
      canon: 'round'
      created: 1
      created_by: 'cjb'
      touched: 1
      touched_by: 'cjb'
      puzzles: []
    id = Meteor.callAs 'newPuzzle', 'torgen',
      name: 'Foo'
      round: round
    ._id
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
      link: 'https://testhuntpleaseign.org/puzzles/foo'
      drive: 'fid'
      spreadsheet: 'sid'
      doc: 'did'
      tags: {}

  describe 'when one exists with that name', ->
    round = round
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
      round = model.Rounds.insert
        name: 'Round'
        canon: 'round'
        created: 1
        created_by: 'cjb'
        touched: 1
        touched_by: 'cjb'
        puzzles: [id1]
      id2 = Meteor.callAs 'newPuzzle', 'cjb',
        name: 'Foo'
        round: round
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
