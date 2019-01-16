'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'changeSetting', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
  
  it 'fails without login', ->
    model.Settings.insert
      _id: 'foo'
      value: 'bar'
    chai.assert.throws ->
      Meteor.call 'changeSetting', 'foo', 'qux'
    , Match.Error
  
  it 'changes setting', ->
    model.Settings.insert
      _id: 'foo'
      value: 'bar'
    chai.assert.isTrue Meteor.callAs 'changeSetting', 'torgen', 'Foo', 'qux'
    chai.assert.deepEqual model.Settings.findOne('foo'),
      _id: 'foo'
      value: 'qux'
      touched: 7
      touched_by: 'torgen'

  it 'doesn\'t create setting', ->
    chai.assert.isFalse Meteor.callAs 'changeSetting', 'torgen', 'foo', 'qux'
    chai.assert.isUndefined model.Settings.findOne 'foo'