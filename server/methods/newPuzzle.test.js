/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Messages, Puzzles, Roles, Rounds } from '/lib/imports/collections.coffee';
import { callAs, impersonating } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import isDuplicateError from '/lib/imports/duplicate.coffee';
import { drive } from '/lib/imports/environment.coffee';
import { PuzzleUrlPrefix, RoleRenewalTime, UrlSeparator } from '/lib/imports/settings.coffee';

describe('newPuzzle', function() {
  let driveMethods = null;
  let clock = null;
  beforeEach(function() {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ['Date']});
    return driveMethods = {
      createPuzzle: sinon.fake.returns({
        id: 'fid', // f for folder
        spreadId: 'sid'
      }),
      renamePuzzle: sinon.spy(),
      deletePuzzle: sinon.spy()
    };
  });

  afterEach(function() {
    clock.restore();
    return sinon.restore();
  });

  beforeEach(function() {
    resetDatabase();
    PuzzleUrlPrefix.ensure();
    RoleRenewalTime.ensure();
    return UrlSeparator.ensure();
  });

  it('fails without login', () => chai.assert.throws(() => Meteor.call('newPuzzle', {
    name: 'Foo',
    link: 'https://puzzlehunt.mit.edu/foo'
  }
  )
  , Match.Error));
    
  describe('when none exists with that name', function() {
    let round = null;
    let id = null;
    describe('when onduty', function() { 
      beforeEach(function() {
        round = Rounds.insert({
          name: 'Round',
          canon: 'round',
          created: 1,
          created_by: 'cjb',
          touched: 1,
          touched_by: 'cjb',
          puzzles: []});
        Roles.insert({
          _id: 'onduty',
          holder: 'torgen',
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002
        });
        return drive.withValue(driveMethods, () => id = callAs('newPuzzle', 'torgen', {
          name: 'Foo',
          link: 'https://puzzlehunt.mit.edu/foo',
          round
        })._id);
      });

      it('creates puzzle', () => chai.assert.deepInclude(Puzzles.findOne(id), {
        name: 'Foo',
        canon: 'foo',
        created: 7,
        created_by: 'torgen',
        touched: 7,
        touched_by: 'torgen',
        solved: null,
        solved_by: null,
        link: 'https://puzzlehunt.mit.edu/foo',
        drive: 'fid',
        spreadsheet: 'sid',
        tags: {}
      }));

      it('adds puzzle to round', () => chai.assert.deepInclude(Rounds.findOne(round), {
        touched: 7,
        touched_by: 'torgen',
        puzzles: [id]
      }));
      
      it('oplogs', () => chai.assert.lengthOf(Messages.find({id, type: 'puzzles'}).fetch(), 1));
      
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
        round = Rounds.insert({
          name: 'Round',
          canon: 'round',
          created: 1,
          created_by: 'cjb',
          touched: 1,
          touched_by: 'cjb',
          puzzles: []});
        Roles.insert({
          _id: 'onduty',
          holder: 'florgen',
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002
        });
        return drive.withValue(driveMethods, () => id = callAs('newPuzzle', 'torgen', {
          name: 'Foo',
          link: 'https://puzzlehunt.mit.edu/foo',
          round
        })._id);
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
      beforeEach(function() {
        round = Rounds.insert({
          name: 'Round',
          canon: 'round',
          created: 1,
          created_by: 'cjb',
          touched: 1,
          touched_by: 'cjb',
          puzzles: []});
        return drive.withValue(driveMethods, () => id = callAs('newPuzzle', 'torgen', {
          name: 'Foo',
          link: 'https://puzzlehunt.mit.edu/foo',
          round
        })._id);
      });

      return it('leaves onduty alone', () => chai.assert.isNotOk(Roles.findOne('onduty')));
    });
  });

  describe('with mechanics', function() {
    let round = null;
    beforeEach(() => round = Rounds.insert({
      name: 'Round',
      canon: 'round',
      created: 1,
      created_by: 'cjb',
      touched: 1,
      touched_by: 'cjb',
      puzzles: []}));

    it('dedupes mechanics', () => drive.withValue(driveMethods, function() {
      const id = callAs('newPuzzle', 'torgen', {
        name: 'Foo',
        link: 'https://puzzlehunt.mit.edu/foo',
        round,
        mechanics: ['crossword', 'crossword', 'cryptic_clues']
      })
      ._id;
      return chai.assert.deepEqual(Puzzles.findOne(id).mechanics, ['crossword', 'cryptic_clues']);
  }));

    return it('rejects bad mechanics', () => chai.assert.throws(() => callAs('newPuzzle', 'torgen', {
      name: 'Foo',
      link: 'https://puzzlehunt.mit.edu/foo',
      round,
      mechanics: ['acrostic']
    })
    , Match.Error));
  });


  it('derives link', () => drive.withValue(driveMethods, function() {
    impersonating('cjb', () => PuzzleUrlPrefix.set('https://testhuntpleaseign.org/puzzles'));
    const round = Rounds.insert({
      name: 'Round',
      canon: 'round',
      created: 1,
      created_by: 'cjb',
      touched: 1,
      touched_by: 'cjb',
      puzzles: []});
    const id = callAs('newPuzzle', 'torgen', {
      name: 'Foo Puzzle',
      round
    })._id;
    return chai.assert.deepInclude(Puzzles.findOne(id), {
      name: 'Foo Puzzle',
      canon: 'foo_puzzle',
      created: 7,
      created_by: 'torgen',
      touched: 7,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      link: 'https://testhuntpleaseign.org/puzzles/foo-puzzle',
      drive: 'fid',
      spreadsheet: 'sid',
      tags: {}
    });
}));

  describe('when one exists with that name', function() {
    var round = round;
    let id1 = null;
    let error = null;
    beforeEach(function() {
      id1 = Puzzles.insert({
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
        tags: {}});
      round = Rounds.insert({
        name: 'Round',
        canon: 'round',
        created: 1,
        created_by: 'cjb',
        touched: 1,
        touched_by: 'cjb',
        puzzles: [id1]});
      try {
        return drive.withValue(driveMethods, () => callAs('newPuzzle', 'cjb', {
          name: 'Foo',
          round
        }
        ));
      } catch (err) {
        return error = err;
      }
    });
    
    it('throws duplicate error', () => chai.assert.isTrue(isDuplicateError(error), `${error}`));

    it('doesn\'t touch', () => chai.assert.include(Puzzles.findOne(id1), {
      created: 1,
      created_by: 'torgen',
      touched: 1,
      touched_by: 'torgen'
    }
    ));

    return it('doesn\'t oplog', () => chai.assert.lengthOf(Messages.find({id: id1, type: 'puzzles'}).fetch(), 0));
  });

  return describe('when drive fails', function() {
    let round = null;
    beforeEach(function() {
      round = Rounds.insert({
        name: 'Round',
        canon: 'round',
        created: 1,
        created_by: 'cjb',
        touched: 1,
        touched_by: 'cjb',
        puzzles: []});
      return driveMethods.createPuzzle = sinon.fake.throws('user limits');
    });

    return it('sets status', () => drive.withValue(driveMethods, function() {
      const id = callAs('newPuzzle', 'torgen', {
        name: 'Foo',
        link: 'https://puzzlehunt.mit.edu/foo',
        round
      })._id;
      return chai.assert.include(Puzzles.findOne(id), {
        drive_status: 'failed',
        drive_error_message: 'Error: user limits'
      }
      );
    }));
  });
});
