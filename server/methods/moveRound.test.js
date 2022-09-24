// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Rounds } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('moveRound', function() {
  
  let clock = null;
  let id1 = null;
  let id2 = null;
  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(function() {
    resetDatabase();
    id1 = Rounds.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen',
      sort_key: 1,
      puzzles: ['yoy'],
      link: 'https://puzzlehunt.mit.edu/foo',
      tags: {}});
    return id2 = Rounds.insert({
      name: 'Bar',
      canon: 'bar',
      created: 2,
      created_by: 'cjb',
      touched: 2,
      touched_by: 'cjb',
      sort_key: 2,
      puzzles: ['harumph'],
      link: 'https://puzzlehunt.mit.edu/bar',
      tags: {}});});

  it('fails without login', () => chai.assert.throws(() => Meteor.call('moveRound', id1, 1)
  , Match.Error));

  return describe('when logged in', function() {
    it('moves later', function() {
      callAs('moveRound', 'jeff', id1, 1);
      chai.assert.include(Rounds.findOne(id1), {
        created: 1,
        touched: 1,
        sort_key: 2
      }
      );
      return chai.assert.include(Rounds.findOne(id2), {
        created: 2,
        touched: 2,
        sort_key: 1
      }
      );
    });

    it('moves earlier', function() {
      callAs('moveRound', 'jeff', id2, -1);
      chai.assert.include(Rounds.findOne(id1), {
        created: 1,
        touched: 1,
        sort_key: 2
      }
      );
      return chai.assert.include(Rounds.findOne(id2), {
        created: 2,
        touched: 2,
        sort_key: 1
      }
      );
    });

    it('bounces off top', function() {
      callAs('moveRound', 'jeff', id1, -1);
      chai.assert.include(Rounds.findOne(id1), {
        created: 1,
        touched: 1,
        sort_key: 1
      }
      );
      return chai.assert.include(Rounds.findOne(id2), {
        created: 2,
        touched: 2,
        sort_key: 2
      }
      );
    });

    return it('bounces off botton', function() {
      callAs('moveRound', 'jeff', id2, 1);
      chai.assert.include(Rounds.findOne(id1), {
        created: 1,
        touched: 1,
        sort_key: 1
      }
      );
      return chai.assert.include(Rounds.findOne(id2), {
        created: 2,
        touched: 2,
        sort_key: 2
      }
      );
    });
  });
});
