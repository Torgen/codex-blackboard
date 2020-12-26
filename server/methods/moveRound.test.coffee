'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'moveRound', ->
  
  clock = null
  id1 = null
  id2 = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    id1 = model.Rounds.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      sort_key: 1
      puzzles: ['yoy']
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    id2 = model.Rounds.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cjb'
      touched: 2
      touched_by: 'cjb'
      sort_key: 2
      puzzles: ['harumph']
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'moveRound', id1, 1
    , Match.Error

  describe 'when logged in', ->
    it 'moves later', ->
      callAs 'moveRound', 'jeff', id1, 1
      chai.assert.include model.Rounds.findOne(id1),
        created: 1
        touched: 1
        sort_key: 2
      chai.assert.include model.Rounds.findOne(id2),
        created: 2
        touched: 2
        sort_key: 1

    it 'moves earlier', ->
      callAs 'moveRound', 'jeff', id2, -1
      chai.assert.include model.Rounds.findOne(id1),
        created: 1
        touched: 1
        sort_key: 2
      chai.assert.include model.Rounds.findOne(id2),
        created: 2
        touched: 2
        sort_key: 1

    it 'bounces off top', ->
      callAs 'moveRound', 'jeff', id1, -1
      chai.assert.include model.Rounds.findOne(id1),
        created: 1
        touched: 1
        sort_key: 1
      chai.assert.include model.Rounds.findOne(id2),
        created: 2
        touched: 2
        sort_key: 2

    it 'bounces off botton', ->
      callAs 'moveRound', 'jeff', id2, 1
      chai.assert.include model.Rounds.findOne(id1),
        created: 1
        touched: 1
        sort_key: 1
      chai.assert.include model.Rounds.findOne(id2),
        created: 2
        touched: 2
        sort_key: 2
