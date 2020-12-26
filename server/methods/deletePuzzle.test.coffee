'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'deletePuzzle', ->
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

  id = null
  meta = null
  rid = null
  beforeEach ->
    resetDatabase()
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
      tags: {}
      drive: 'ffoo'
      spreadsheet: 'sfoo'
      doc: 'dfoo'
    meta = model.Puzzles.insert
      name: 'Meta'
      canon: 'meta'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      incorrectAnswers: []
      tags: {}
      puzzles: [id]
      drive: 'fmeta'
      spreadsheet: 'smeta'
      doc: 'dmeta'
    rid = model.Rounds.insert
      name: 'Bar'
      canon: 'bar'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: [id, meta]
      tags: {}

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'deletePuzzle', id
    , Match.Error

  describe 'when logged in', ->
    ret = null
    beforeEach ->
      ret = callAs 'deletePuzzle', 'cjb', id

    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'puzzles', room_name: 'oplog/0'}).fetch(), 1

    it 'removes puzzle from round', ->
      chai.assert.deepEqual model.Rounds.findOne(rid),
        _id: rid
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        touched: 7
        touched_by: 'cjb'
        solved: null
        solved_by: null
        puzzles: [meta]
        tags: {}

    it 'removes puzzle from meta', ->
      chai.assert.deepEqual model.Puzzles.findOne(meta),
        _id: meta
        name: 'Meta'
        canon: 'meta'
        created: 1
        created_by: 'torgen'
        touched: 7
        touched_by: 'cjb'
        solved: null
        solved_by: null
        incorrectAnswers: []
        puzzles: []
        tags: {}
        drive: 'fmeta'
        spreadsheet: 'smeta'
        doc: 'dmeta'

    it 'deletes drive', ->
      chai.assert.deepEqual driveMethods.deletePuzzle.getCall(0).args, ['ffoo']
