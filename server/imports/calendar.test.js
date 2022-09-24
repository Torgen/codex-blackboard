// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Calendar, CalendarEvents } from '/lib/imports/collections.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import delay from 'delay';
import { waitForDocument } from '/lib/imports/testutils.coffee';
import { CalendarSync } from './calendar.coffee';

describe('CalendarSync', function() {
  let clock = null;
  let api = null;
  let acl = null;
  let calendarList = null;
  let calendars = null;
  let events = null;
  let sync = null;

  beforeEach(function() {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 60007,
      toFake: ['setTimeout', 'clearTimeout', 'Date']});
    
    api = {
      events: {
        list() {}
      },
      acl: {
        list() {},
        insert() {}
      },
      calendars: {
        insert() {}
      },
      calendarList: {
        list() {}
      }
    };
    acl = sinon.mock(api.acl);
    events = sinon.mock(api.events);
    calendars = sinon.mock(api.calendars);
    calendarList = sinon.mock(api.calendarList);

    return Meteor.settings.folder = 'Calendar Test';
  });

  afterEach(function() {
    sync?.stop();

    clock.restore();
    // Meteor uses underlying setTimeout for stuff, so you have to run any leftover timeouts
    // or it can break later tests.
    return clock.runAll();
  });

  afterEach(() => sinon.verifyAndRestore());

  const testCases = function() {
    describe('with existing calendar', function() {
      beforeEach(function() {
        Calendar.insert({_id: 'testCalendar', syncToken: 'syncToken1'});
        CalendarEvents.insert({
          _id: 'evt1',
          summary: 'Event 1',
          location: 'Planet Nowhere',
          start: 1640814960000,
          end: 1640818560000
        });
        CalendarEvents.insert({
          _id: 'evt3',
          summary: 'Will be deleted',
          start: 1640814960000,
          end: 1640818560000
        });
        calendarList.expects('list').never();
        return calendars.expects('insert').never();
      });

      it('updates incrementally', function() {
        events.expects('list').once().withArgs(sinon.match({
          calendarId: 'testCalendar',
          pageToken: null,
          syncToken: 'syncToken1'
        })).resolves({data: {
          nextSyncToken: 'syncToken2',
          items: [
            {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
            start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}},
            {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
            start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}},
            {id: 'evt3', status: 'cancelled'}
          ]
        }});
        sync = new CalendarSync(api);
        chai.assert.include(Calendar.findOne(), {
          _id: 'testCalendar',
          syncToken: 'syncToken2'
        }
        );
        chai.assert.include(CalendarEvents.findOne({_id: 'evt1'}), {
          summary: 'Event One',
          start: 1640815200000,
          end: 1640818800000,
          link: 'https://calendar.google.com/event/evt1'
        }
        );
        chai.assert.include(CalendarEvents.findOne({_id: 'evt2'}), {
          summary: 'Event Two',
          location: 'Kresge Auditorium',
          start: 1640901600000,
          end: 1640905200000
        }
        );
        return chai.assert.isNotOk(CalendarEvents.findOne({_id: 'evt3'}));
      });

      return it('does full sync when gone', function() {
        const e = new Error;
        e.code = 410;
        const list = events.expects('list').twice().onFirstCall().rejects(e)
        .onSecondCall().resolves({data: {
          nextSyncToken: 'syncToken2',
          items: [
            {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
            start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}},
            {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
            start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}}
          ]
        }});
        sync = new CalendarSync(api);
        chai.assert.include(Calendar.findOne(), {
          _id: 'testCalendar',
          syncToken: 'syncToken2'
        }
        );
        chai.assert.include(CalendarEvents.findOne({_id: 'evt1'}), {
          summary: 'Event One',
          start: 1640815200000,
          end: 1640818800000,
          link: 'https://calendar.google.com/event/evt1'
        }
        );
        chai.assert.include(CalendarEvents.findOne({_id: 'evt2'}), {
          summary: 'Event Two',
          location: 'Kresge Auditorium',
          start: 1640901600000,
          end: 1640905200000
        }
        );
        chai.assert.deepEqual(list.getCall(0).args[0], {
          calendarId: 'testCalendar',
          pageToken: null,
          syncToken: 'syncToken1'
        }
        );
        return chai.assert.deepEqual(list.getCall(1).args[0], {
          calendarId: 'testCalendar',
          pageToken: null,
          syncToken: null
        }
        );
      });
    });

    it('looks up calendar', function() {
      calendarList.expects('list').once().resolves({
        data: {
          items: [{id: 'someOtherCalendar', summary: 'Who cares?'},
                  {id: 'testCalendar', summary: 'Calendar Test'}]
        }});
      calendars.expects('insert').never();
      const list = events.expects('list').twice().onFirstCall().resolves({data: {
        nextPageToken: 'page1',
        items: [
          {id: 'evt1', summary: 'Event One', htmlLink: 'https://calendar.google.com/event/evt1', 
          start: {dateTime: '2021-12-29T22:00:00+00:00'}, end: {dateTime: '2021-12-29T23:00:00+00:00'}}
        ]
      }
      }).onSecondCall().resolves({data: {
        nextSyncToken: 'syncToken1',
        items: [
          {id: 'evt2', summary: 'Event Two', location: 'Kresge Auditorium', 
          start: {dateTime: '2021-12-30T22:00:00+00:00'}, end: {dateTime: '2021-12-30T23:00:00+00:00'}}
        ]
      }});
      sync = new CalendarSync(api);
      chai.assert.include(Calendar.findOne(), {
        _id: 'testCalendar',
        syncToken: 'syncToken1'
      }
      );
      chai.assert.include(CalendarEvents.findOne({_id: 'evt1'}), {
        summary: 'Event One',
        start: 1640815200000,
        end: 1640818800000,
        link: 'https://calendar.google.com/event/evt1'
      }
      );
      chai.assert.include(CalendarEvents.findOne({_id: 'evt2'}), {
        summary: 'Event Two',
        location: 'Kresge Auditorium',
        start: 1640901600000,
        end: 1640905200000
      }
      );
      chai.assert.deepEqual(list.getCall(0).args[0], {
        calendarId: 'testCalendar',
        pageToken: null,
        syncToken: null
      }
      );
      return chai.assert.deepEqual(list.getCall(1).args[0], {
        calendarId: 'testCalendar',
        pageToken: 'page1',
        syncToken: null
      }
      );
    });

    return it('creates calendar', function() {
      calendarList.expects('list').once().resolves({
        data: {items: []}});
      calendars.expects('insert').once().withArgs(sinon.match({
        requestBody: {
          summary: 'Calendar Test',
          timeZone: 'America/New_York'
        }
      })).resolves({data: {id: 'testCalendar'}});
      events.expects('list').once().withArgs(sinon.match({
        calendarId: 'testCalendar',
        pageToken: null,
        syncToken: null 
      })).resolves({data: {
        nextSyncToken: 'syncToken1',
        items: []
      }});
      sync = new CalendarSync(api);
      chai.assert.include(Calendar.findOne(), {
        _id: 'testCalendar',
        syncToken: 'syncToken1'
      }
      );
      return chai.assert.isNotOk(CalendarEvents.findOne());
    });
  };

  describe('with acls already set', function() {
    beforeEach(function() {
      Meteor.settings.driveowner = 'foo@bar.baz';
      Meteor.settings.drive_share_group = 'group@bar.baz';
      acl.expects('list').once().withArgs(sinon.match({calendarId: 'testCalendar', maxResults: 250})).resolves({
        data: { items: [
          {role: 'reader', scope: {type: 'default'}},
          {role: 'writer', scope: {
            type: 'group',
            value: 'group@bar.baz'
          }},
          {role: 'owner', scope: {
            type: 'user',
            value: 'foo@bar.baz'
          }},
      ]
      }});
      return acl.expects('insert').never();
    });

    return testCases();
  });

  return describe('with default acls', function() {
    let insert = null;
    beforeEach(function() {
      Meteor.settings.driveowner = 'foo@bar.baz';
      Meteor.settings.drive_share_group = 'group@bar.baz';
      acl.expects('list').once().withArgs(sinon.match({calendarId: 'testCalendar', maxResults: 250})).resolves({
        data: {items: [{role: 'none', scope: {type: 'default'}}]}});
      return insert = acl.expects('insert').thrice().resolves();
    });

    afterEach(function() {
      chai.assert.deepInclude(insert.getCall(0).args[0], {
        calendarId: 'testCalendar',
        requestBody: {
          role: 'reader',
          scope: { type: 'default'
        }
        }
      }
      );
      chai.assert.deepInclude(insert.getCall(1).args[0], {
        calendarId: 'testCalendar',
        requestBody: {
          role: 'writer',
          scope: {
            type: 'group',
            value: 'group@bar.baz'
          }
        }
      }
      );
      return chai.assert.deepInclude(insert.getCall(2).args[0], {
        calendarId: 'testCalendar',
        requestBody: {
          role: 'owner',
          scope: {
            type: 'user',
            value: 'foo@bar.baz'
          }
        }
      }
      );
    });

    return testCases();
  });
});
