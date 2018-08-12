'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setPresence', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'create', ->
    describe 'when present', ->
      it 'sets foreground false', ->
        Meteor.call 'setPresence',
          nick: 'torgen'
          room_name: 'general/0'
          present: true
          foreground: false
          uuid: '12345'
        doc = model.Presence.findOne({nick: 'torgen', room_name: 'general/0'})
        chai.assert.notInclude doc,
          foreground: false
          foreground_uuid: null

      it 'sets foreground true', ->
        Meteor.call 'setPresence',
          nick: 'torgen'
          room_name: 'general/0'
          present: true
          foreground: true
          uuid: '12345'
        chai.assert.include model.Presence.findOne({nick: 'torgen', room_name: 'general/0'}),
          foreground: true
          foreground_uuid: '12345'
    describe 'when absent', ->
      [false, true].forEach (foreground) =>
        it "ignores foreground when #{foreground}", ->
          Meteor.call 'setPresence',
            nick: 'torgen'
            room_name: 'general/0'
            present: false
            foreground: foreground
            uuid: '12345'
          chai.assert.notInclude model.Presence.findOne({nick: 'torgen', room_name: 'general/0'}),
            foreground: null
            foreground_uuid: null

  describe 'update', ->
    it 'leaves foreground when present is false', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: true
        foreground_uuid: '23456'
      Meteor.call 'setPresence',
        nick: 'torgen'
        room_name: 'general/0'
        present: false
        foreground: true
        uuid: '12345'
      doc = model.Presence.findOne({nick: 'torgen', room_name: 'general/0'})
      chai.assert.include doc,
        present: false
        foreground: true
        foreground_uuid: '23456'

    it 'updates uuid when foreground is true', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: true
        foreground_uuid: '23456'
      Meteor.call 'setPresence',
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: true
        uuid: '12345'
      doc = model.Presence.findOne({nick: 'torgen', room_name: 'general/0'})
      chai.assert.include doc,
        present: true
        foreground: true
        foreground_uuid: '12345'

    it 'leaves uuid when foreground is false', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: true
        foreground_uuid: '23456'
      Meteor.call 'setPresence',
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: false
        uuid: '12345'
      chai.assert.include model.Presence.findOne({nick: 'torgen', room_name: 'general/0'}),
        present: true
        foreground: true
        foreground_uuid: '23456'

    it 'sets foreground false when uuid matches', ->
      model.Presence.insert
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: true
        foreground_uuid: '23456'
      Meteor.call 'setPresence',
        nick: 'torgen'
        room_name: 'general/0'
        present: true
        foreground: false
        uuid: '23456'
      chai.assert.include model.Presence.findOne({nick: 'torgen', room_name: 'general/0'}),
        present: true
        foreground: false
        foreground_uuid: '23456'
    