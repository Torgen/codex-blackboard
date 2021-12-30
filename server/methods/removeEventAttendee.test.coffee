'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'removeEventAttendee', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    Meteor.users.insert _id: 'cjb'
    model.CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cjb', 'cscott']
    chai.assert.throws ->
      Meteor.call 'removeEventAttendee', 'evt1', 'cjb'
    , Match.Error

  it 'fails when no such event', ->
    Meteor.users.insert _id: 'cjb'
    chai.assert.isFalse callAs 'removeEventAttendee', 'cjb', 'evt1', 'cjb'

  it 'fails when no such user', ->
    model.CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.throws ->
      callAs 'removeEventAttendee', 'cjb', 'evt1', 'cjb'
    , Match.Error

  it 'removes attendee', ->
    Meteor.users.insert _id: 'cjb'
    model.CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cjb', 'cscott']
    chai.assert.isTrue callAs 'removeEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']

  it 'removes someone else', ->
    Meteor.users.insert _id: 'bjc'
    model.CalendarEvents.insert
      _id: 'evt1'
      attendees: ['bjc', 'cscott']
    chai.assert.isTrue callAs 'removeEventAttendee', 'cjb', 'evt1', 'bjc'
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']

  it 'noop when not attending', ->
    Meteor.users.insert _id: 'cjb'
    model.CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.isTrue callAs 'removeEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']
