'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newQuip', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  beforeEach ->
    resetDatabase()

  afterEach ->
    clock.restore()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'newQuip', 'something'
    , Match.Error

  describe 'when logged in', ->
    id = null

    beforeEach ->
      id = callAs('newQuip', 'torgen', 'I\'m codex, and there are wolves after me.')._id
    
    it 'creates document', ->
      chai.assert.include model.Quips.findOne(id),
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        last_used: 0
        use_count: 0
        text: 'I\'m codex, and there are wolves after me.'
        name: 'Odessa Clayter'  # from hash of text

    it 'oplogs', ->
      chai.assert.lengthOf model.Messages.find({type: 'quips', id: id}).fetch(), 1

    

  