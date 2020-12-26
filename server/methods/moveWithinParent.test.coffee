'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

testCase = (method, collection) ->
  describe method, ->

    clock = null

    beforeEach ->
      clock = sinon.useFakeTimers
        now: 7
        toFake: ['Date']

    afterEach ->
      clock.restore()

    beforeEach ->
      resetDatabase()

      collection.insert
        _id: 'parent'
        puzzles: ['c1', 'c2', 'c3', 'c4']
        created_by: 'cjb'
        created: 4
        touched_by: 'cjb'
        touched: 4

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call method, 'parent', 'c1', pos: 1
      , Match.Error

    it 'fails when parent doesn\'t exist', ->
      chai.assert.isFalse callAs method, 'torgen', 'nosuch', 'child', pos: 1

    it 'fails when child doesn\'t exist', ->
      chai.assert.isFalse callAs method, 'torgen', 'parent', 'c5', pos: 1
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c2', 'c3', 'c4']
        touched_by: 'cjb'
        touched: 4

    it 'moves down one', ->
      chai.assert.isTrue callAs method, 'torgen', 'c2', 'parent', pos: 1
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c3', 'c2', 'c4']
        touched_by: 'torgen'
        touched: 7

    it 'moves up one', ->
      chai.assert.isTrue callAs method, 'torgen', 'c3', 'parent', pos: -1
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c3', 'c2', 'c4']
        touched_by: 'torgen'
        touched: 7

    it 'moves down several', ->
      chai.assert.isTrue callAs method, 'torgen', 'c2', 'parent', pos: 2
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c3', 'c4', 'c2']
        touched_by: 'torgen'
        touched: 7

    it 'moves up several', ->
      chai.assert.isTrue callAs method, 'torgen', 'c3', 'parent', pos: -2
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c3', 'c1', 'c2', 'c4']
        touched_by: 'torgen'
        touched: 7

    it 'fails to move past end', ->
      chai.assert.isFalse callAs method, 'torgen', 'c4', 'parent', pos: 1
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c2', 'c3', 'c4']
        touched_by: 'cjb'
        touched: 4

    it 'fails to move past start', ->
      chai.assert.isFalse callAs method, 'torgen', 'c1', 'parent', pos: -1
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c2', 'c3', 'c4']
        touched_by: 'cjb'
        touched: 4

    it 'moves before', ->
      chai.assert.isTrue callAs method, 'torgen', 'c2', 'parent', before: 'c4'
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c3', 'c2', 'c4']
        touched_by: 'torgen'
        touched: 7

    it 'moves after', ->
      chai.assert.isTrue callAs method, 'torgen', 'c3', 'parent', after: 'c1'
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c3', 'c2', 'c4']
        touched_by: 'torgen'
        touched: 7

    it 'fails to move before absent', ->
      chai.assert.isFalse callAs method, 'torgen', 'c2', 'parent', before: 'c5'
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c2', 'c3', 'c4']
        touched_by: 'cjb'
        touched: 4

    it 'fails to move after absent', ->
      chai.assert.isFalse callAs method, 'torgen', 'c3', 'parent', after: 'c5'
      chai.assert.deepInclude collection.findOne('parent'),
        puzzles: ['c1', 'c2', 'c3', 'c4']
        touched_by: 'cjb'
        touched: 4

testCase 'moveWithinMeta', model.Puzzles
testCase 'moveWithinRound', model.Rounds
