'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'newRound',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
        puzzles: ['yoy']
    , Match.Error
  
  describe 'when none exists with that name', ->
    id = null
    beforeEach ->
      id = Meteor.callAs 'newRound', 'torgen',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
      ._id

    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 1

    it 'creates round', ->
      # Round is created, then drive et al are added
      round = model.Rounds.findOne id
      chai.assert.deepInclude round,
        name: 'Foo'
        canon: 'foo'
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        puzzles: []
        link: 'https://puzzlehunt.mit.edu/foo'
        tags: {}
      ['solved', 'solved_by', 'incorrectAnswers', 'drive', 'spreadsheet', 'doc'].forEach (prop) =>
        chai.assert.notProperty round, prop
  
  it 'derives link', ->
    model.Settings.insert
      _id: 'round_url_prefix'
      value: 'https://testhuntpleaseign.org/rounds'
    id = Meteor.callAs 'newRound', 'torgen',
      name: 'Foo'
    ._id
    # Round is created, then drive et al are added
    round = model.Rounds.findOne id
    chai.assert.deepInclude round,
      name: 'Foo'
      canon: 'foo'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      puzzles: []
      link: 'https://testhuntpleaseign.org/rounds/foo'
      tags: {}

  describe 'when one has that name', ->
    id1 = null
    id2 = null
    beforeEach ->
      id1 = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        puzzles: ['yoy']
        link: 'https://puzzlehunt.mit.edu/foo'
        tags: {}
      id2 = Meteor.callAs 'newRound', 'cjb',
        name: 'Foo'
      ._id

    it 'returns existing round', ->
      chai.assert.equal id1, id2

    it 'doesn\'t touch', ->
      chai.assert.include model.Rounds.findOne(id2),
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: id2, type: 'rounds'}).fetch(), 0
