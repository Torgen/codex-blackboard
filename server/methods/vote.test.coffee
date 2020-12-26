'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'vote', ->
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
    model.Polls.insert
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes: {}
    chai.assert.throws ->
      Meteor.call 'vote', 'foo', 'foo'
    , Match.Error

  it 'fails with missing poll', ->
    chai.assert.throws ->
      callAs 'vote', 'torgen', '', 'foo'
    , Match.Error

  it 'fails with missing option', ->
    chai.assert.throws ->
      callAs 'vote', 'torgen', 'foo'
    , Match.Error

  it 'no-ops when no such poll', ->
    callAs 'vote', 'torgen', 'foo', 'bar'
    chai.assert.notExists model.Polls.findOne()

  it 'no-ops when no such option', ->
    model.Polls.insert
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes: metasj: {canon: 'foo', timestamp: 4}
    callAs 'vote', 'torgen', 'foo', 'qux'
    chai.assert.deepEqual model.Polls.findOne(),
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes: metasj: {canon: 'foo', timestamp: 4}

  it 'adds vote', ->
    model.Polls.insert
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes: metasj: {canon: 'foo', timestamp: 4}
    callAs 'vote', 'torgen', 'foo', 'bar'
    chai.assert.deepEqual model.Polls.findOne(),
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes:
        metasj: {canon: 'foo', timestamp: 4}
        torgen: {canon: 'bar', timestamp: 7}

  it 'changes vote', ->
    model.Polls.insert
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes: metasj: {canon: 'foo', timestamp: 4}
    callAs 'vote', 'metasj', 'foo', 'bar'
    chai.assert.deepEqual model.Polls.findOne(),
      _id: 'foo'
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}]
      created: 2
      created_by: 'cscott'
      votes:
        metasj: {canon: 'bar', timestamp: 7}
