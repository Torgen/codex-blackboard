'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'favorite', ->
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    sinon.restore()

  beforeEach ->
    resetDatabase()

  describe 'when no such puzzle', ->
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'favorite', 'id'
      , Match.Error

    describe 'when logged in', ->
      ret = null
      beforeEach ->
        ret = Meteor.callAs 'favorite', 'cjb', 'id'

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
        ret = Meteor.callAs 'favorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'sets favorites', ->
        chai.assert.deepEqual model.Puzzles.findOne(id).favorites, ['cjb']

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
        favorites: ['torgen', 'cscott']
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
        ret = Meteor.callAs 'favorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'sets favorites', ->
        chai.assert.deepEqual model.Puzzles.findOne(id).favorites, ['torgen', 'cscott', 'cjb']

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
        favorites: ['torgen', 'cjb']
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
        ret = Meteor.callAs 'favorite', 'cjb', id

      it 'returns true', ->
        chai.assert.isTrue ret

      it 'leaves favorites unchanged', ->
        chai.assert.deepEqual model.Puzzles.findOne(id).favorites, ['torgen', 'cjb']

      it 'does not touch', ->
        doc = model.Puzzles.findOne id
        chai.assert.equal doc.touched, 1
        chai.assert.equal doc.touched_by, 'torgen'
