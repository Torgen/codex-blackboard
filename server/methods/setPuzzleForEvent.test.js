/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { CalendarEvents, Puzzles } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('setPuzzleForEvent', function() {
  beforeEach(() => resetDatabase());

  it('fails without login', function() {
    Puzzles.insert({
      _id: 'puzz'});
    CalendarEvents.insert({
      _id: 'evt'});
    return chai.assert.throws(() => Meteor.call('setPuzzleForEvent', 'evt', 'puzz')
    , Match.Error);
  });

  it('fails when no such puzzle', function() {
    CalendarEvents.insert({
      _id: 'evt'});
    return chai.assert.throws(() => callAs('setPuzzleForEvent', 'cjb', 'evt', 'puzz')
    , Match.Error);
  });

  it('fails when no such event', function() {
    Puzzles.insert({
      _id: 'puzz'});
    return chai.assert.isFalse(callAs('setPuzzleForEvent', 'cjb', 'evt', 'puzz'));
  });

  it('sets unset puzzle', function() {
    Puzzles.insert({
      _id: 'puzz'});
    CalendarEvents.insert({
      _id: 'evt'});
    callAs('setPuzzleForEvent', 'cjb', 'evt', 'puzz');
    return chai.assert.deepEqual(CalendarEvents.findOne({_id: 'evt'}), {
      _id: 'evt',
      puzzle: 'puzz'
    }
    );
  });

  it('overwrites set puzzle', function() {
    Puzzles.insert({
      _id: 'puzz'});
    CalendarEvents.insert({
      _id: 'evt',
      puzzle: 'fizz'
    });
    callAs('setPuzzleForEvent', 'cjb', 'evt', 'puzz');
    return chai.assert.deepEqual(CalendarEvents.findOne({_id: 'evt'}), {
      _id: 'evt',
      puzzle: 'puzz'
    }
    );
  });

  return it('unsets puzzle', function() {
    Puzzles.insert({
      _id: 'puzz'});
    CalendarEvents.insert({
      _id: 'evt',
      puzzle: 'puzz'
    });
    callAs('setPuzzleForEvent', 'cjb', 'evt', null);
    return chai.assert.deepEqual(CalendarEvents.findOne({_id: 'evt'}),
      {_id: 'evt'});
  });
});
