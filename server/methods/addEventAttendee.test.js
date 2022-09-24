'use strict'

# For side effects
import '/lib/model.coffee'
import { CalendarEvents } from '/lib/imports/collections.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'addEventAttendee', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.throws ->
      Meteor.call 'addEventAttendee', 'evt1', 'cjb'
    , Match.Error

  it 'fails when no such event', ->
    Meteor.users.insert _id: 'cjb'
    chai.assert.isFalse callAs 'addEventAttendee', 'cjb', 'evt1', 'cjb'

  it 'fails when no such user', ->
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.throws ->
      callAs 'addEventAttendee', 'cjb', 'evt1', 'cjb'
    , Match.Error

  it 'adds attendee', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.isTrue callAs 'addEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepInclude CalendarEvents.findOne(_id: 'evt1'),
      attendees: ['cscott', 'cjb']

  it 'adds someone else', ->
    Meteor.users.insert _id: 'bjc'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.isTrue callAs 'addEventAttendee', 'cjb', 'evt1', 'bjc'
    chai.assert.deepInclude CalendarEvents.findOne(_id: 'evt1'),
      attendees: ['cscott', 'bjc']

  it 'noop when already attending', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cjb', 'cscott']
    chai.assert.isTrue callAs 'addEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepInclude CalendarEvents.findOne(_id: 'evt1'),
      attendees: ['cjb', 'cscott']
