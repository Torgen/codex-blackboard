'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'updatelastRead', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'creates', ->
    Meteor.call 'updateLastRead',
      nick: 'torgen'
      room_name: 'general/0',
      timestamp: 3
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3

  it 'advances', ->
    model.LastRead.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 2
    Meteor.call 'updateLastRead',
      nick: 'torgen'
      room_name: 'general/0',
      timestamp: 3
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3

  it 'doesn\'t retreat', ->
    model.LastRead.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 3
    Meteor.call 'updateLastRead',
      nick: 'torgen'
      room_name: 'general/0',
      timestamp: 2
    chai.assert.include model.LastRead.findOne({nick: 'torgen', room_name: 'general/0'}),
      timestamp: 3
    
