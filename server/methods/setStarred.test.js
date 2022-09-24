// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects 
import '/lib/model.js';
import { Messages } from '/lib/imports/collections.js';
import { callAs } from '/server/imports/impersonate.js';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('setStarred', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it('fails without login', function() {
    const id = Messages.insert({
      nick: 'torgen',
      body: 'nobody star this',
      timestamp: 5,
      room_name: 'general/0'
    });
    return chai.assert.throws(() => Meteor.call('setStarred', id, true)
    , Match.Error);
  });

  describe('in main room', function() {
    it('announces on star', function() {
      const id = Messages.insert({
        nick: 'torgen',
        body: 'nobody star this',
        timestamp: 5,
        room_name: 'general/0'
      });
      callAs('setStarred', 'cjb', id, true);
      return chai.assert.include(Messages.findOne(id), {
        starred: true,
        announced_at: 7,
        announced_by: 'cjb'
      }
      );
    });

    it('leaves announced on unstar', function() {
      const id = Messages.insert({
        nick: 'torgen',
        body: 'nobody star this',
        timestamp: 5,
        room_name: 'general/0',
        announced_at: 6,
        announced_by: 'cjb'
      });
      callAs('setStarred', 'cjb', id, false);
      return chai.assert.include(Messages.findOne(id), {
        starred: null,
        announced_at: 6,
        announced_by: 'cjb'
      }
      );
    });

    return it('does not reannounce on re-star', function() {
      const id = Messages.insert({
        nick: 'torgen',
        body: 'nobody star this',
        timestamp: 5,
        room_name: 'general/0',
        starred: false,
        announced_at: 6,
        announced_by: 'kwal'
      });
      callAs('setStarred', 'cjb', id, true);
      return chai.assert.include(Messages.findOne(id), {
        starred: true,
        announced_at: 6,
        announced_by: 'kwal'
      }
      );
    });
  });

  describe('in other room', function() {
    it('stars but does not announce', function() {
      const id = Messages.insert({
        nick: 'torgen',
        body: 'nobody star this',
        timestamp: 5,
        room_name: 'puzzles/0'
      });
      callAs('setStarred', 'cjb', id, true);
      const msg = Messages.findOne(id);
      chai.assert.include(msg,
        {starred: true});
      chai.assert.notProperty(msg, 'announced_at');
      return chai.assert.notProperty(msg, 'announced_by');
    });

    return it('unstars', function() {
      const id = Messages.insert({
        nick: 'torgen',
        body: 'nobody star this',
        timestamp: 5,
        room_name: 'puzzles/0'
      });
      callAs('setStarred', 'cjb', id, false);
      return chai.assert.include(Messages.findOne(id),
        {starred: null});
    });
  });

  return it('fails on unstarrable', function() {
    const id = Messages.insert({
      nick: 'torgen',
      body: 'won\'t let you star this',
      action: true,
      timestamp: 5,
      room_name: 'general/0'
    });
    callAs('setStarred', 'cjb', id, true);
    return chai.assert.notInclude(Messages.findOne(id),
      {starred: null});
  });
});
            
          