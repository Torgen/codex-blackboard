'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'cancelCallIn', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  puzzle = null
  callin = null
  beforeEach ->
    puzzle = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 1
      touched_by: 'cscott'
      solved: null
      solved_by: null
      tags: {}
    callin = model.CallIns.insert
      name: 'Foo:precipitate'
      target: puzzle
      answer: 'precipitate'
      created: 2
      created_by: 'torgen'
      submitted_to_hq: true
      backsolve: false
      provided: false
      status: 'pending'
      
  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'cancelCallIn', id: callin
    , Match.Error

  describe 'when logged in', ->
    beforeEach ->
      callAs 'cancelCallIn', 'cjb', id: callin

    it 'updates callin', ->
      c = model.CallIns.findOne()
      chai.assert.include c,
        status: 'cancelled'
    
    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({type: 'puzzles', id: puzzle}).fetch(), 1
