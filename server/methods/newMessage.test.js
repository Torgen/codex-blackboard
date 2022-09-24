'use strict'

# For side effects 
import './newMessage.coffee'
import { Messages } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

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
      chai.assert.deepEqual Messages.findOne(msg._id),
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
      chai.assert.deepEqual Messages.findOne(msg._id),
        _id: msg._id
        room_name: 'general/0'
        nick: 'torgen'
        bodyIsHtml: true
        timestamp: 7
        action: true
        body: 'has requested help: stuck (puzzle <a class="puzzles-link" target="_blank" href="/puzzles/2">Example</a>)'
