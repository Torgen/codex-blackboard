// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Messages, Roles, Rounds } from '/lib/imports/collections.coffee';
import { callAs, impersonating } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import isDuplicateError from '/lib/imports/duplicate.coffee';
import { RoleRenewalTime, RoundUrlPrefix, UrlSeparator } from '/lib/imports/settings.coffee';

describe('newRound', function() {
  let clock = null;
  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(function() {
    clock.restore();
    return sinon.restore();
  });

  beforeEach(function() {
    resetDatabase();
    RoleRenewalTime.ensure();
    RoundUrlPrefix.ensure();
    return UrlSeparator.ensure();
  });


  it('fails without login', () => chai.assert.throws(() => Meteor.call('newRound', {
    name: 'Foo',
    link: 'https://puzzlehunt.mit.edu/foo',
    puzzles: ['yoy']
  })
  , Match.Error));
  
  describe('when none exists with that name', function() {
    let id = null;
    describe('when onduty', function() {
      beforeEach(function() {
        Roles.insert({
          _id: 'onduty',
          holder: 'torgen',
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002
        });
        return id = callAs('newRound', 'torgen', {
          name: 'Foo',
          link: 'https://puzzlehunt.mit.edu/foo'
        })._id;
      });

      it('oplogs', () => chai.assert.lengthOf(Messages.find({id, type: 'rounds'}).fetch(), 1));

      it('creates round', function() {
        // Round is created, then drive et al are added
        const round = Rounds.findOne(id);
        chai.assert.deepInclude(round, {
          name: 'Foo',
          canon: 'foo',
          created: 7,
          created_by: 'torgen',
          touched: 7,
          touched_by: 'torgen',
          puzzles: [],
          link: 'https://puzzlehunt.mit.edu/foo',
          tags: {}
        });
        return ['solved', 'solved_by', 'drive', 'spreadsheet', 'doc'].forEach(prop => chai.assert.notProperty(round, prop));
      });

      return it('renews onduty', () => chai.assert.deepInclude(Roles.findOne('onduty'), {
        holder: 'torgen',
        claimed_at: 2,
        renewed_at: 7,
        expires_at: 3600007
      }
      ));
    });
    
    describe('when someone else is onduty', function() {
      beforeEach(function() {
        Roles.insert({
          _id: 'onduty',
          holder: 'florgen',
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002
        });
        return id = callAs('newRound', 'torgen', {
          name: 'Foo',
          link: 'https://puzzlehunt.mit.edu/foo'
        })._id;
      });

      return it('leaves onduty alone', () => chai.assert.deepInclude(Roles.findOne('onduty'), {
        holder: 'florgen',
        claimed_at: 2,
        renewed_at: 2,
        expires_at: 3600002
      }
      ));
    });
    
    return describe('when nobody is onduty', function() {
      beforeEach(() => id = callAs('newRound', 'torgen', {
        name: 'Foo',
        link: 'https://puzzlehunt.mit.edu/foo'
      })._id);

      return it('leaves onduty alone', () => chai.assert.isNotOk(Roles.findOne('onduty')));
    });
  });
  
  it('derives link', function() {
    impersonating('cjb', () => RoundUrlPrefix.set('https://testhuntpleaseign.org/rounds'));
    const id = callAs('newRound', 'torgen',
      {name: 'Foo Round'})
    ._id;
    // Round is created, then drive et al are added
    const round = Rounds.findOne(id);
    return chai.assert.deepInclude(round, {
      name: 'Foo Round',
      canon: 'foo_round',
      created: 7,
      created_by: 'torgen',
      touched: 7,
      touched_by: 'torgen',
      puzzles: [],
      link: 'https://testhuntpleaseign.org/rounds/foo-round',
      tags: {}
    });
});

  return describe('when one has that name', function() {
    let id1 = null;
    let error = null;
    beforeEach(function() {
      id1 = Rounds.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'torgen',
        touched: 1,
        touched_by: 'torgen',
        puzzles: ['yoy'],
        link: 'https://puzzlehunt.mit.edu/foo',
        tags: {}});
      try {
        return callAs('newRound', 'cjb',
          {name: 'Foo'});
      } catch (err) {
        return error = err;
      }
    });

    it('throws duplicate error', () => chai.assert.isTrue(isDuplicateError(error), `${error}`));

    it('doesn\'t touch', () => chai.assert.include(Rounds.findOne(id1), {
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen'
    }
    ));

    return it('doesn\'t oplog', () => chai.assert.lengthOf(Messages.find({id: id1, type: 'rounds'}).fetch(), 0));
  });
});
