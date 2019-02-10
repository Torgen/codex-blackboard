'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  [null, true].forEach (was_starred) =>
    describe "starred was #{was_starred}", ->
      [false, true].forEach (set_starred) =>
        describe "set to #{set_starred}", ->
          id = null
          beforeEach ->
            id = model.Messages.insert
              nick: 'torgen'
              body: 'nobody star this'
              timestamp: 5
              room_name: 'general/0'
              starred: was_starred
          it 'fails without login', ->
            chai.assert.throws ->
              Meteor.call 'setStarred', id, set_starred
            , Match.Error
          describe 'when logged in', ->
            it 'succeeds', ->
              Meteor.callAs 'setStarred', 'cjb', id, set_starred
              chai.assert.include model.Messages.findOne(id),
                starred: set_starred or null
  it 'fails on unstarrable', ->
    id = model.Messages.insert
      nick: 'torgen'
      body: 'won\'t let you star this'
      action: true
      timestamp: 5
      room_name: 'general/0'
    Meteor.callAs 'setStarred', 'cjb', id, true
    chai.assert.notInclude model.Messages.findOne(id),
      starred: null
            
          