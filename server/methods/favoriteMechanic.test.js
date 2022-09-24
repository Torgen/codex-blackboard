/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
// Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('favoriteMechanic', function() {
  beforeEach(() => resetDatabase());

  it('fails without login', () => chai.assert.throws(() => Meteor.call('favoriteMechanic', 'cryptic_clues')
  , Match.Error));

  it('fails when no such user', () => chai.assert.throws(() => callAs('favoriteMechanic', 'cjb', 'cryptic_clues')
  , Meteor.Error));

  describe('when user has favorite mechanics', function() {
    beforeEach(() => Meteor.users.insert({
      _id: 'torgen',
      favorite_mechanics: ['nikoli_variants']}));

    it('adds new mechanic', function() {
      callAs('favoriteMechanic', 'torgen', 'cryptic_clues');
      return chai.assert.deepEqual(Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants', 'cryptic_clues']);
  });

    it('will not duplicate mechanic', function() {
      callAs('favoriteMechanic', 'torgen', 'nikoli_variants');
      return chai.assert.deepEqual(Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants']);
  });

    return it('rejects bad mechanic', () => chai.assert.throws(() => callAs('favoriteMechanic', 'torgen', 'minesweeper')
    , Match.Error));
  });

  return describe('when user has no favorite mechanics', function() {
    beforeEach(() => Meteor.users.insert({
      _id: 'torgen'}));

    return it('creates favorite mechanics', function() {
      callAs('favoriteMechanic', 'torgen', 'cryptic_clues');
      return chai.assert.deepEqual(Meteor.users.findOne('torgen').favorite_mechanics, ['cryptic_clues']);
  });
});
});
