// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Puzzles } from '/lib/imports/collections.coffee';
// Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('favorite', function() {
  let clock = null;
  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  describe('when no such puzzle', function() {
    it('fails without login', () => chai.assert.throws(() => Meteor.call('favorite', 'id')
    , Match.Error));

    return describe('when logged in', function() {
      let ret = null;
      beforeEach(() => ret = callAs('favorite', 'cjb', 'id'));

      return it('returns false', () => chai.assert.isFalse(ret));
    });
  });

  describe('when favorites is absent', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      link: 'https://puzzlehunt.mit.edu/foo',
      drive: 'fid',
      spreadsheet: 'sid',
      doc: 'did',
      tags: {}}));

    it('fails without login', () => chai.assert.throws(() => Meteor.call('favorite', id)
    , Match.Error));

    return describe('when logged in', function() {
      let ret = null;
      beforeEach(() => ret = callAs('favorite', 'cjb', id));

      it('returns true', () => chai.assert.isTrue(ret));

      it('sets favorites', () => chai.assert.deepEqual(Puzzles.findOne(id).favorites,
        {cjb: true}));

      return it('does not touch', function() {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        return chai.assert.equal(doc.touched_by, 'torgen');
      });
    });
  });

  describe('when favorites has others', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      favorites: {
        torgen: true,
        cscott: true
      },
      link: 'https://puzzlehunt.mit.edu/foo',
      drive: 'fid',
      spreadsheet: 'sid',
      doc: 'did',
      tags: {}}));

    it('fails without login', () => chai.assert.throws(() => Meteor.call('favorite', id)
    , Match.Error));

    return describe('when logged in', function() {
      let ret = null;
      beforeEach(() => ret = callAs('favorite', 'cjb', id));

      it('returns true', () => chai.assert.isTrue(ret));

      it('sets favorites', () => chai.assert.deepEqual(Puzzles.findOne(id).favorites, {
        torgen: true,
        cscott: true,
        cjb: true
      }
      ));

      return it('does not touch', function() {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        return chai.assert.equal(doc.touched_by, 'torgen');
      });
    });
  });

  return describe('when favorites has self', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      favorites: {
        torgen: true,
        cjb: true
      },
      link: 'https://puzzlehunt.mit.edu/foo',
      drive: 'fid',
      spreadsheet: 'sid',
      doc: 'did',
      tags: {}}));

    it('fails without login', () => chai.assert.throws(() => Meteor.call('favorite', id)
    , Match.Error));

    return describe('when logged in', function() {
      let ret = null;
      beforeEach(() => ret = callAs('favorite', 'cjb', id));

      it('returns true', () => chai.assert.isTrue(ret));

      it('leaves favorites unchanged', () => chai.assert.deepEqual(Puzzles.findOne(id).favorites, {
        torgen: true,
        cjb: true
      }
      ));

      return it('does not touch', function() {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        return chai.assert.equal(doc.touched_by, 'torgen');
      });
    });
  });
});
