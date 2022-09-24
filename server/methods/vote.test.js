/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Polls } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('vote', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it('fails without login', function() {
    Polls.insert({
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: {}});
    return chai.assert.throws(() => Meteor.call('vote', 'foo', 'foo')
    , Match.Error);
  });

  it('fails with missing poll', () => chai.assert.throws(() => callAs('vote', 'torgen', '', 'foo')
  , Match.Error));

  it('fails with missing option', () => chai.assert.throws(() => callAs('vote', 'torgen', 'foo')
  , Match.Error));

  it('no-ops when no such poll', function() {
    callAs('vote', 'torgen', 'foo', 'bar');
    return chai.assert.notExists(Polls.findOne());
  });

  it('no-ops when no such option', function() {
    Polls.insert({
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: { metasj: {canon: 'foo', timestamp: 4}
    }});
    callAs('vote', 'torgen', 'foo', 'qux');
    return chai.assert.deepEqual(Polls.findOne(), {
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: { metasj: {canon: 'foo', timestamp: 4}
    }
    });
});

  it('adds vote', function() {
    Polls.insert({
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: { metasj: {canon: 'foo', timestamp: 4}
    }});
    callAs('vote', 'torgen', 'foo', 'bar');
    return chai.assert.deepEqual(Polls.findOne(), {
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: {
        metasj: {canon: 'foo', timestamp: 4},
        torgen: {canon: 'bar', timestamp: 7}
      }
    });
});

  return it('changes vote', function() {
    Polls.insert({
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: { metasj: {canon: 'foo', timestamp: 4}
    }});
    callAs('vote', 'metasj', 'foo', 'bar');
    return chai.assert.deepEqual(Polls.findOne(), {
      _id: 'foo',
      options: [{canon: 'foo', option: 'Foo'}, {canon: 'bar', option: 'Bar'}],
      created: 2,
      created_by: 'cscott',
      votes: {
        metasj: {canon: 'bar', timestamp: 7}
      }
    });
});
});
