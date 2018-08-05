'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setStarred', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  ['messages', 'oldmessages'].forEach (collection) =>
    describe "in #{collection}", ->
      [null, true].forEach (was_starred) =>
        describe "starred was #{was_starred}", ->
          [false, true].forEach (set_starred) =>
            describe "set to #{set_starred}", ->
              it 'succeeds', ->
                id = model.collection(collection).insert
                  nick: 'torgen'
                  body: 'nobody star this'
                  timestamp: 5
                  room_name: 'general/0'
                  starred: was_starred
                Meteor.call 'setStarred', id, set_starred
                chai.assert.include model.collection(collection).findOne(id),
                  starred: set_starred or null
      it 'fails on unstarrable', ->
        id = model.collection(collection).insert
          nick: 'torgen'
          body: 'won\'t let you star this'
          action: true
          timestamp: 5
          room_name: 'general/0'
        Meteor.call 'setStarred', id, true
        chai.assert.notInclude model.collection(collection).findOne(id),
          starred: null
            
          