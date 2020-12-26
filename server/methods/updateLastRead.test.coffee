'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'updatelastRead', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'updateLastRead',
        room_name: 'general/0',
        timestamp: 3
    , Match.Error
    
  it 'creates', ->
    callAs 'updateLastRead', 'torgen',
      room_name: 'general/0',
      timestamp: 3
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3

  it 'advances', ->
    model.LastRead.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 2
    callAs 'updateLastRead', 'torgen',
      room_name: 'general/0'
      timestamp: 3
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3

  it 'doesn\'t retreat', ->
    model.LastRead.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 3
    callAs 'updateLastRead', 'torgen',
      room_name: 'general/0'
      timestamp: 2
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3
    
