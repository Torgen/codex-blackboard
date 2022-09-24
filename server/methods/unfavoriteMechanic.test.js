// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('unfavoriteMechanic', function() {
  beforeEach(() => resetDatabase());

  it('fails without login', () => chai.assert.throws(() => Meteor.call('unfavoriteMechanic', 'cryptic_clues')
  , Match.Error));

  it('fails when no such user', () => chai.assert.throws(() => callAs('unfavoriteMechanic', 'cjb', 'cryptic_clues')
  , Meteor.Error));

  describe('when user has favorite mechanics', function() {
    beforeEach(() => Meteor.users.insert({
      _id: 'torgen',
      favorite_mechanics: ['nikoli_variants', 'cryptic_clues']}));

    it('removes mechanic', function() {
      callAs('unfavoriteMechanic', 'torgen', 'cryptic_clues');
      return chai.assert.deepEqual(Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants']);
  });

    it('ignores absent mechanic', function() {
      callAs('unfavoriteMechanic', 'torgen', 'crossword');
      return chai.assert.deepEqual(Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants', 'cryptic_clues']);
  });

    return it('rejects bad mechanic', () => chai.assert.throws(() => callAs('unfavoriteMechanic', 'torgen', 'minesweeper')
    , Match.Error));
  });

  return describe('when user has no favorite mechanics', function() {
    beforeEach(() => Meteor.users.insert({
      _id: 'torgen'}));

    return it('leaves favorite mechanics absent', function() {
      callAs('unfavoriteMechanic', 'torgen', 'cryptic_clues');
      return chai.assert.isUndefined(Meteor.users.findOne('torgen').favorite_mechanics);
    });
  });
});
