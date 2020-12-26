'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

msg = 'This is codex. Your hunt is bad and you should feel bad.'

describe 'useQuip', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  id = null
  beforeEach ->
    resetDatabase()
    id = model.Quips.insert
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      name: 'Hector Mercilessly'
      text: msg
      last_used: 3
      use_count: 2

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'useQuip', id: id
    , Match.Error
  
  describe 'not punted', ->
    quip = null
    beforeEach ->
      callAs 'useQuip', 'cjb', id: id
      quip = model.Quips.findOne id
    
    it 'updates document', ->
      chai.assert.include quip,
        created: 1
        created_by: 'torgen'
        touched: 7
        touched_by: 'cjb'
        last_used: 7
        use_count: 3
    
    it 'tells general chat', ->
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', action: true}).fetch(), 1
  
  describe 'punted', ->
    quip = null
    beforeEach ->
      callAs 'useQuip', 'cjb',
        id: id
        punted: true
      quip = model.Quips.findOne id
    
    it 'updates document', ->
      chai.assert.include quip,
        created: 1
        created_by: 'torgen'
        touched: 7
        touched_by: 'cjb'
        last_used: 7
        use_count: 2
    
    it 'no message', ->
      chai.assert.lengthOf model.Messages.find(room_name: 'general/0').fetch(), 0




