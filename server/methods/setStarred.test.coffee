'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setStarred', ->
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
    id = model.Messages.insert
      nick: 'torgen'
      body: 'nobody star this'
      timestamp: 5
      room_name: 'general/0'
    chai.assert.throws ->
      Meteor.call 'setStarred', id, true
    , Match.Error

  describe 'in main room', ->
    it 'announces on star', ->
      id = model.Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
      callAs 'setStarred', 'cjb', id, true
      chai.assert.include model.Messages.findOne(id),
        starred: true
        announced_at: 7
        announced_by: 'cjb'

    it 'leaves announced on unstar', ->
      id = model.Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
        announced_at: 6
        announced_by: 'cjb'
      callAs 'setStarred', 'cjb', id, false
      chai.assert.include model.Messages.findOne(id),
        starred: null
        announced_at: 6
        announced_by: 'cjb'

    it 'does not reannounce on re-star', ->
      id = model.Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
        starred: false
        announced_at: 6
        announced_by: 'kwal'
      callAs 'setStarred', 'cjb', id, true
      chai.assert.include model.Messages.findOne(id),
        starred: true
        announced_at: 6
        announced_by: 'kwal'

  describe 'in other room', ->
    it 'stars but does not announce', ->
      id = model.Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'callins/0'
      callAs 'setStarred', 'cjb', id, true
      msg = model.Messages.findOne(id)
      chai.assert.include msg,
        starred: true
      chai.assert.notProperty msg, 'announced_at'
      chai.assert.notProperty msg, 'announced_by'

    it 'unstars', ->
      id = model.Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'callins/0'
      callAs 'setStarred', 'cjb', id, false
      chai.assert.include model.Messages.findOne(id),
        starred: null

  it 'fails on unstarrable', ->
    id = model.Messages.insert
      nick: 'torgen'
      body: 'won\'t let you star this'
      action: true
      timestamp: 5
      room_name: 'general/0'
    callAs 'setStarred', 'cjb', id, true
    chai.assert.notInclude model.Messages.findOne(id),
      starred: null
            
          