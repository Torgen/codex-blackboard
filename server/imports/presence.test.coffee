'use strict'


# Will access contents via share
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import delay from 'delay'
import { waitForDocument } from '/lib/imports/testutils.coffee'
import watchPresence from './presence.coffee'

model = share.model

describe 'presence', ->
  clock = null
  presence = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 7
      toFake: ["setInterval", "clearInterval", "Date"]

  afterEach ->
    presence.stop()
    clock.restore()
  
  describe 'join', ->

    it 'ignores existing presence', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      await delay 200
      chai.assert.isUndefined model.Messages.findOne presence: 'join', nick: 'torgen'

    it 'ignores oplog room', ->
      presence = watchPresence()
      model.Presence.insert
        nick: 'torgen'
        room_name: 'oplog/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      await delay 200
      chai.assert.isUndefined model.Messages.findOne presence: 'join', nick: 'torgen'

    it 'ignores non-chat scope', ->
      presence = watchPresence()
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'jitsi'
        timestamp: 9
        joined_timestamp: 8
        clients: [{connection_id: 'test', timestamp: 9}]
      await delay 200
      chai.assert.isUndefined model.Messages.findOne presence: 'join', nick: 'torgen'

    it 'uses nickname when no users entry', ->
      presence = watchPresence()
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 9
        joined_timestamp: 8
        clients: [{connection_id: 'test', timestamp: 9}]
      waitForDocument model.Messages, {nick: 'torgen', presence: 'join'},
        system: true
        room_name: 'general/0'
        body: 'torgen joined the room.'
        timestamp: 8

    it 'uses real name from users entry', ->
      presence = watchPresence()
      Meteor.users.insert
        _id: 'torgen'
        nickname: 'Torgen'
        real_name: 'Dan Rosart'
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 8
        joined_timestamp: 8
        clients: [{connection_id: 'test', timestamp: 9}]
      waitForDocument model.Messages, {nick: 'torgen', presence: 'join'},
        system: true
        room_name: 'general/0'
        body: 'Dan Rosart joined the room.'
        timestamp: 8

  describe 'part', ->

    it 'ignores oplog room', ->
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'oplog/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      model.Presence.remove id
      await delay 200
      chai.assert.isUndefined model.Messages.findOne presence: 'part', nick: 'torgen'

    it 'ignores non-chat scope', ->
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'jitsi'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      model.Presence.remove id
      await delay 200
      chai.assert.isUndefined model.Messages.findOne presence: 'part', nick: 'torgen'

    it 'removes stale presence', ->
      # This would happen in the server restarted.
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'jitsi'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      clock.tick 240000
      await delay 200
      chai.assert.isUndefined model.Presence.findOne id

    it 'removes presence without connections', ->
      # This would happen if you closed the tab or changed rooms.
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      model.Presence.update id, $set: clients: []
      await delay 200
      chai.assert.isUndefined model.Presence.findOne id

    it 'uses nickname when no users entry', ->
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      presence = watchPresence()
      model.Presence.remove id
      waitForDocument model.Messages, {nick: 'torgen', presence: 'part'},
        system: true
        room_name: 'general/0'
        body: 'torgen left the room.'
        timestamp: 7

    it 'uses real name from users entry', ->
      id = model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      Meteor.users.insert
        _id: 'torgen'
        nickname: 'Torgen'
        real_name: 'Dan Rosart'
      presence = watchPresence()
      model.Presence.remove id
      waitForDocument model.Messages, {nick: 'torgen', presence: 'part'},
        system: true
        room_name: 'general/0'
        body: 'Dan Rosart left the room.'
        timestamp: 7

  describe 'update', ->
    it 'updates unsolved puzzle', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'puzzles/foo'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      model.Puzzles.insert
        _id: 'foo'
        solverTime: 45
      presence = watchPresence()
      model.Presence.update {nick: 'torgen', room_name:'puzzles/foo'},
        $set: timestamp: 15
      waitForDocument model.Puzzles, {_id: 'foo', solverTime: 54}, {}

    it 'ignores bot user', ->
      model.Presence.insert
        nick: 'botto'
        room_name: 'puzzles/foo'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
        bot: true
      model.Puzzles.insert
        _id: 'foo'
        solverTime: 45
      presence = watchPresence()
      model.Presence.update {nick: 'botto', room_name:'puzzles/foo'},
        $set: timestamp: 15
      waitForDocument model.Puzzles, {_id: 'foo', solverTime: 45}, {}

    it 'ignores solved puzzle', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'puzzles/foo'
        scope: 'chat'
        timestamp: 6
        joined_timestamp: 6
        clients: [{connection_id: 'test', timestamp: 6}]
      model.Puzzles.insert
        _id: 'foo'
        solverTime: 45
        solved: 80
      presence = watchPresence()
      model.Presence.update {nick: 'torgen', room_name:'puzzles/foo'},
        $set: timestamp: 15
      await delay 200
      chai.assert.deepInclude model.Puzzles.findOne('foo'),
        solverTime: 45
