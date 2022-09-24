'use strict'

# For side effects
import '/lib/model.coffee'
import { CalendarEvents } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'removeEventAttendee', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cjb', 'cscott']
    chai.assert.throws ->
      Meteor.call 'removeEventAttendee', 'evt1', 'cjb'
    , Match.Error

  it 'fails when no such event', ->
    Meteor.users.insert _id: 'cjb'
    chai.assert.isFalse callAs 'removeEventAttendee', 'cjb', 'evt1', 'cjb'

  it 'fails when no such user', ->
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.throws ->
      callAs 'removeEventAttendee', 'cjb', 'evt1', 'cjb'
    , Match.Error

  it 'removes attendee', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cjb', 'cscott']
    chai.assert.isTrue callAs 'removeEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']

  it 'removes someone else', ->
    Meteor.users.insert _id: 'bjc'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['bjc', 'cscott']
    chai.assert.isTrue callAs 'removeEventAttendee', 'cjb', 'evt1', 'bjc'
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']

  it 'noop when not attending', ->
    Meteor.users.insert _id: 'cjb'
    CalendarEvents.insert
      _id: 'evt1'
      attendees: ['cscott']
    chai.assert.isTrue callAs 'removeEventAttendee','cjb', 'evt1', 'cjb'
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt1'),
      _id: 'evt1'
      attendees: ['cscott']
