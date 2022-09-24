/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Messages, Polls } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('newPoll', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it('fails without login', () => chai.assert.throws(() => Meteor.call('newPoll', 'general/0', 'What up?', ['Sky', 'Ceiling', 'Aliens'])
  , Match.Error));

  it('fails with no options', () => chai.assert.throws(() => callAs('newPoll', 'torgen', 'general/0', 'What up?', [])
  , Match.Error));

  it('fails with one option', () => chai.assert.throws(() => callAs('newPoll', 'torgen', 'general/0', 'What up?', ['everything'])
  , Match.Error));

  it('fails with six options', () => chai.assert.throws(() => callAs('newPoll', 'torgen', 'general/0', 'What up?', ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'])
  , Match.Error));

  it('fails with no room', () => chai.assert.throws(() => callAs('newPoll', 'torgen', '', 'What up?', ['Sky', 'Ceiling', 'Aliens'])
  , Match.Error));

  it('fails with no question', () => chai.assert.throws(() => callAs('newPoll', 'torgen', 'general/0', '', ['Sky', 'Ceiling', 'Aliens'])
  , Match.Error));

  it('canonicalizes options', function() {
    callAs('newPoll', 'torgen', 'general/0', 'What up?', ['Red', 'Orange', 'Yellow', 'Green', 'red']);
    return chai.assert.deepInclude(Polls.findOne(), {
      created: 7,
      created_by: 'torgen',
      question: 'What up?',
      options: [
        {canon: 'red', option: 'Red'},
        {canon: 'orange', option: 'Orange'},
        {canon: 'yellow', option: 'Yellow'},
        {canon: 'green', option: 'Green'}
      ],
      votes: {}
    });
});

  return it('creates message', function() {
    callAs('newPoll', 'torgen', 'general/0', 'What up?', ['Red', 'Orange', 'Yellow', 'Green', 'Blue']);
    const p = Polls.findOne()._id;
    return chai.assert.deepInclude(Messages.findOne({dawn_of_time: {$ne: true}}), {
      room_name: 'general/0',
      nick: 'torgen',
      body: 'What up?',
      timestamp: 7,
      poll: p
    }
    );
  });
});


