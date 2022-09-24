// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects 
import './newMessage.coffee';
import { Messages } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('newMessage', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  return describe('bodyIsHtml', function() {
    it('strips script', function() {
      const msg = callAs('newMessage', 'torgen', {
        bodyIsHtml: true,
        body: 'Haha <script>alert("ownd")</script> you'
      }
      );
      return chai.assert.deepEqual(Messages.findOne(msg._id), {
        _id: msg._id,
        room_name: 'general/0',
        nick: 'torgen',
        bodyIsHtml: true,
        timestamp: 7,
        body: 'Haha  you'
      }
      );
    });

    return it('allows classes', function() {
      const msg = callAs('newMessage', 'torgen', {
        bodyIsHtml: true,
        body: 'has requested help: stuck (puzzle <a class="puzzles-link" target=_blank href="/puzzles/2">Example</a>)',
        action: true
      }
      );
      return chai.assert.deepEqual(Messages.findOne(msg._id), {
        _id: msg._id,
        room_name: 'general/0',
        nick: 'torgen',
        bodyIsHtml: true,
        timestamp: 7,
        action: true,
        body: 'has requested help: stuck (puzzle <a class="puzzles-link" target="_blank" href="/puzzles/2">Example</a>)'
      }
      );
    });
  });
});
