'use strict'

# For side effects 
import '/lib/model.coffee'
import { Messages } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

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
    id = Messages.insert
      nick: 'torgen'
      body: 'nobody star this'
      timestamp: 5
      room_name: 'general/0'
    chai.assert.throws ->
      Meteor.call 'setStarred', id, true
    , Match.Error

  describe 'in main room', ->
    it 'announces on star', ->
      id = Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
      callAs 'setStarred', 'cjb', id, true
      chai.assert.include Messages.findOne(id),
        starred: true
        announced_at: 7
        announced_by: 'cjb'

    it 'leaves announced on unstar', ->
      id = Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
        announced_at: 6
        announced_by: 'cjb'
      callAs 'setStarred', 'cjb', id, false
      chai.assert.include Messages.findOne(id),
        starred: null
        announced_at: 6
        announced_by: 'cjb'

    it 'does not reannounce on re-star', ->
      id = Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'general/0'
        starred: false
        announced_at: 6
        announced_by: 'kwal'
      callAs 'setStarred', 'cjb', id, true
      chai.assert.include Messages.findOne(id),
        starred: true
        announced_at: 6
        announced_by: 'kwal'

  describe 'in other room', ->
    it 'stars but does not announce', ->
      id = Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'puzzles/0'
      callAs 'setStarred', 'cjb', id, true
      msg = Messages.findOne(id)
      chai.assert.include msg,
        starred: true
      chai.assert.notProperty msg, 'announced_at'
      chai.assert.notProperty msg, 'announced_by'

    it 'unstars', ->
      id = Messages.insert
        nick: 'torgen'
        body: 'nobody star this'
        timestamp: 5
        room_name: 'puzzles/0'
      callAs 'setStarred', 'cjb', id, false
      chai.assert.include Messages.findOne(id),
        starred: null

  it 'fails on unstarrable', ->
    id = Messages.insert
      nick: 'torgen'
      body: 'won\'t let you star this'
      action: true
      timestamp: 5
      room_name: 'general/0'
    callAs 'setStarred', 'cjb', id, true
    chai.assert.notInclude Messages.findOne(id),
      starred: null
            
          