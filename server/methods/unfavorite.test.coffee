'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'unfavorite', ->
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'when no such puzzle', ->
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'unfavorite', 'id'
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'unfavorite', 'cjb', 'id'

      it 'returns false', ->
        chai.assert.isFalse ret

  describe 'when favorites is absent', ->
    id = null
    beforeEach ->
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
        tags: {}

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'favorite', id
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'unfavorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'leaves favorites unset', ->
        chai.assert.isUndefined model.Puzzles.findOne(id).favorites

      it 'does not touch', ->
        doc = model.Puzzles.findOne id
        chai.assert.equal doc.touched, 1
        chai.assert.equal doc.touched_by, 'torgen'

  describe 'when favorites has others', ->
    id = null
    beforeEach ->
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
        favorites:
          torgen: true
          cscott: true
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: {}

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'unfavorite', id
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'unfavorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'leaves favorites unchanged', ->
        chai.assert.deepEqual model.Puzzles.findOne(id).favorites,
          torgen: true
          cscott: true

      it 'does not touch', ->
        doc = model.Puzzles.findOne id
        chai.assert.equal doc.touched, 1
        chai.assert.equal doc.touched_by, 'torgen'

  describe 'when favorites has self', ->
    id = null
    beforeEach ->
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
        favorites:
          torgen: true
          cjb: true
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: {}

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'unfavorite', id
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = callAs 'unfavorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'removes self from favorites', ->
        chai.assert.deepEqual model.Puzzles.findOne(id).favorites,
          torgen: true

      it 'does not touch', ->
        doc = model.Puzzles.findOne id
        chai.assert.equal doc.touched, 1
        chai.assert.equal doc.touched_by, 'torgen'
