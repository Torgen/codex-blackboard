'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs, impersonating } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import isDuplicateError from '/lib/imports/duplicate.coffee'
import { RoundUrlPrefix } from '/lib/imports/settings.coffee'

model = share.model

describe 'newRound', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']
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
    clock.restore()
    sinon.restore()

  beforeEach ->
    resetDatabase()
    RoundUrlPrefix.ensure()

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
      id = callAs 'newRound', 'torgen',
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
      ['solved', 'solved_by', 'drive', 'spreadsheet', 'doc'].forEach (prop) =>
        chai.assert.notProperty round, prop
  
  it 'derives link', ->
    impersonating 'cjb', -> RoundUrlPrefix.set 'https://testhuntpleaseign.org/rounds'
    id = callAs 'newRound', 'torgen',
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
    error = null
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
      try
        callAs 'newRound', 'cjb',
          name: 'Foo'
      catch err
        error = err

    it 'throws duplicate error', ->
      chai.assert.isTrue isDuplicateError(error), "#{error}"

    it 'doesn\'t touch', ->
      chai.assert.include model.Rounds.findOne(id1),
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: id1, type: 'rounds'}).fetch(), 0
