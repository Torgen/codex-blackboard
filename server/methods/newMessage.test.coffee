'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newMessage', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'bodyIsHtml', ->
    it 'strips script', ->
      msg = callAs 'newMessage', 'torgen',
        bodyIsHtml: true
        body: 'Haha <script>alert("ownd")</script> you'
      chai.assert.deepEqual model.Messages.findOne(msg._id),
        _id: msg._id
        room_name: 'general/0'
        nick: 'torgen'
        bodyIsHtml: true
        timestamp: 7
        body: 'Haha  you'

    it 'allows classes', ->
      msg = callAs 'newMessage', 'torgen',
        bodyIsHtml: true
        body: 'has requested help: stuck (puzzle <a class="puzzles-link" target=_blank href="/puzzles/2">Example</a>)'
        action: true
      chai.assert.deepEqual model.Messages.findOne(msg._id),
        _id: msg._id
        room_name: 'general/0'
        nick: 'torgen'
        bodyIsHtml: true
        timestamp: 7
        action: true
        body: 'has requested help: stuck (puzzle <a class="puzzles-link" target="_blank" href="/puzzles/2">Example</a>)'
