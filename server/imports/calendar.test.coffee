'use strict'

# Will access contents via share
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import delay from 'delay'
import { waitForDocument } from '/lib/imports/testutils.coffee'
import { CalendarSync } from './calendar.coffee'

describe 'CalendarSync', ->
  clock = null
  api = null
  acl = null
  calendarList = null
  calendars = null
  events = null
  sync = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 60007
      toFake: ['setTimeout', 'clearTimeout', 'Date']
    
    api =
      events:
        list: ->
      acl:
        list: ->
        insert: ->
      calendars:
        insert: ->
      calendarList:
        list: ->
    acl = sinon.mock api.acl
    events = sinon.mock api.events
    calendars = sinon.mock api.calendars
    calendarList = sinon.mock api.calendarList

    Meteor.settings.folder = 'Calendar Test'

  afterEach ->
    sync?.stop()

    clock.restore()
    # Meteor uses underlying setTimeout for stuff, so you have to run any leftover timeouts
    # or it can break later tests.
    clock.runAll()

  afterEach ->
    sinon.verifyAndRestore()

  testCases = ->
    describe 'with existing calendar', ->
      beforeEach ->
        share.model.Calendar.insert _id: 'testCalendar', syncToken: 'syncToken1'
        share.model.CalendarEvents.insert
          _id: 'evt1'
          summary: 'Event 1'
          location: 'Planet Nowhere'
          start: 1640814960000
          end: 1640818560000
        share.model.CalendarEvents.insert
          _id: 'evt3'
          summary: 'Will be deleted'
          start: 1640814960000
          end: 1640818560000
        calendarList.expects('list').never()
        calendars.expects('insert').never()

      it 'updates incrementally', ->
        events.expects('list').once().withArgs(sinon.match
          calendarId: 'testCalendar'
          pageToken: null
          syncToken: 'syncToken1'
        ).resolves data:
          nextSyncToken: 'syncToken2'
          items: [
            {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
            start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}},
            {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
            start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}},
            {id: 'evt3', status: 'cancelled'}
          ]
        sync = new CalendarSync api
        chai.assert.include share.model.Calendar.findOne(),
          _id: 'testCalendar'
          syncToken: 'syncToken2'
        chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt1'),
          summary: 'Event One'
          start: 1640815200000
          end: 1640818800000
          link: 'https://calendar.google.com/event/evt1'
        chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt2'),
          summary: 'Event Two'
          location: 'Kresge Auditorium'
          start: 1640901600000
          end: 1640905200000
        chai.assert.isNotOk share.model.CalendarEvents.findOne(_id: 'evt3')

      it 'does full sync when gone', ->
        e = new Error
        e.code = 410
        list = events.expects('list').twice().onFirstCall().rejects e
        .onSecondCall().resolves data:
          nextSyncToken: 'syncToken2'
          items: [
            {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
            start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}},
            {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
            start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}}
          ]
        sync = new CalendarSync api
        chai.assert.include share.model.Calendar.findOne(),
          _id: 'testCalendar'
          syncToken: 'syncToken2'
        chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt1'),
          summary: 'Event One'
          start: 1640815200000
          end: 1640818800000
          link: 'https://calendar.google.com/event/evt1'
        chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt2'),
          summary: 'Event Two'
          location: 'Kresge Auditorium'
          start: 1640901600000
          end: 1640905200000
        chai.assert.deepEqual list.getCall(0).args[0],
          calendarId: 'testCalendar'
          pageToken: null
          syncToken: 'syncToken1'
        chai.assert.deepEqual list.getCall(1).args[0],
          calendarId: 'testCalendar'
          pageToken: null
          syncToken: null

    it 'looks up calendar', ->
      calendarList.expects('list').once().resolves
        data:
          items: [{id: 'someOtherCalendar', summary: 'Who cares?'},
                  {id: 'testCalendar', summary: 'Calendar Test'}]
      calendars.expects('insert').never()
      list = events.expects('list').twice().onFirstCall().resolves(data:
        nextPageToken: 'page1'
        items: [
          {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
          start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}}
        ]
      ).onSecondCall().resolves data:
        nextSyncToken: 'syncToken1'
        items: [
          {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
          start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}}
        ]
      sync = new CalendarSync api
      chai.assert.include share.model.Calendar.findOne(),
        _id: 'testCalendar'
        syncToken: 'syncToken1'
      chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt1'),
        summary: 'Event One'
        start: 1640815200000
        end: 1640818800000
        link: 'https://calendar.google.com/event/evt1'
      chai.assert.include share.model.CalendarEvents.findOne(_id: 'evt2'),
        summary: 'Event Two'
        location: 'Kresge Auditorium'
        start: 1640901600000
        end: 1640905200000
      chai.assert.deepEqual list.getCall(0).args[0],
        calendarId: 'testCalendar'
        pageToken: null
        syncToken: null
      chai.assert.deepEqual list.getCall(1).args[0],
        calendarId: 'testCalendar'
        pageToken: 'page1'
        syncToken: null

    it 'creates calendar', ->
      calendarList.expects('list').once().resolves
        data: items: []
      calendars.expects('insert').once().withArgs(sinon.match
        requestBody:
          summary: 'Calendar Test'
          timeZone: 'America/New_York'
      ).resolves data: id: 'testCalendar'
      events.expects('list').once().withArgs(sinon.match
        calendarId: 'testCalendar'
        pageToken: null
        syncToken: null 
      ).resolves data:
        nextSyncToken: 'syncToken1'
        items: []
      sync = new CalendarSync api
      chai.assert.include share.model.Calendar.findOne(),
        _id: 'testCalendar'
        syncToken: 'syncToken1'
      chai.assert.isNotOk share.model.CalendarEvents.findOne()

  describe 'with acls already set', ->
    beforeEach ->
      Meteor.settings.driveowner = 'foo@bar.baz'
      Meteor.settings.drive_share_group = 'group@bar.baz'
      acl.expects('list').once().withArgs(sinon.match {calendarId: 'testCalendar', maxResults: 250}).resolves
        data: items: [
          {role: 'reader', scope: type: 'default'},
          {role: 'writer', scope: {
            type: 'group'
            value: 'group@bar.baz'
          }},
          {role: 'owner', scope: {
            type: 'user'
            value: 'foo@bar.baz'
          }},
      ]
      acl.expects('insert').never()

    testCases()

  describe 'with default acls', ->
    insert = null
    beforeEach ->
      Meteor.settings.driveowner = 'foo@bar.baz'
      Meteor.settings.drive_share_group = 'group@bar.baz'
      acl.expects('list').once().withArgs(sinon.match {calendarId: 'testCalendar', maxResults: 250}).resolves
        data: items: [{role: 'none', scope: type: 'default'}]
      insert = acl.expects('insert').thrice().resolves()

    afterEach ->
      chai.assert.deepInclude insert.getCall(0).args[0],
        calendarId: 'testCalendar'
        requestBody:
          role: 'reader'
          scope: type: 'default'
      chai.assert.deepInclude insert.getCall(1).args[0],
        calendarId: 'testCalendar'
        requestBody:
          role: 'writer'
          scope:
            type: 'group'
            value: 'group@bar.baz'
      chai.assert.deepInclude insert.getCall(2).args[0],
        calendarId: 'testCalendar'
        requestBody:
          role: 'owner'
          scope:
            type: 'user'
            value: 'foo@bar.baz'

    testCases()
