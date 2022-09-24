// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { CalendarEvents } from '/lib/imports/collections.coffee';
// Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('addEventAttendee', function() {
  beforeEach(() => resetDatabase());

  it('fails without login', function() {
    Meteor.users.insert({_id: 'cjb'});
    CalendarEvents.insert({
      _id: 'evt1',
      attendees: ['cscott']});
    return chai.assert.throws(() => Meteor.call('addEventAttendee', 'evt1', 'cjb')
    , Match.Error);
  });

  it('fails when no such event', function() {
    Meteor.users.insert({_id: 'cjb'});
    return chai.assert.isFalse(callAs('addEventAttendee', 'cjb', 'evt1', 'cjb'));
  });

  it('fails when no such user', function() {
    CalendarEvents.insert({
      _id: 'evt1',
      attendees: ['cscott']});
    return chai.assert.throws(() => callAs('addEventAttendee', 'cjb', 'evt1', 'cjb')
    , Match.Error);
  });

  it('adds attendee', function() {
    Meteor.users.insert({_id: 'cjb'});
    CalendarEvents.insert({
      _id: 'evt1',
      attendees: ['cscott']});
    chai.assert.isTrue(callAs('addEventAttendee','cjb', 'evt1', 'cjb'));
    return chai.assert.deepInclude(CalendarEvents.findOne({_id: 'evt1'}),
      {attendees: ['cscott', 'cjb']});
});

  it('adds someone else', function() {
    Meteor.users.insert({_id: 'bjc'});
    CalendarEvents.insert({
      _id: 'evt1',
      attendees: ['cscott']});
    chai.assert.isTrue(callAs('addEventAttendee', 'cjb', 'evt1', 'bjc'));
    return chai.assert.deepInclude(CalendarEvents.findOne({_id: 'evt1'}),
      {attendees: ['cscott', 'bjc']});
});

  return it('noop when already attending', function() {
    Meteor.users.insert({_id: 'cjb'});
    CalendarEvents.insert({
      _id: 'evt1',
      attendees: ['cjb', 'cscott']});
    chai.assert.isTrue(callAs('addEventAttendee','cjb', 'evt1', 'cjb'));
    return chai.assert.deepInclude(CalendarEvents.findOne({_id: 'evt1'}),
      {attendees: ['cjb', 'cscott']});
});
});
