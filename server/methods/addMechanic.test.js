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

describe('addMechanic', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());
    
  it('fails when it doesn\'t exist', () => chai.assert.throws(() => callAs('addMechanic', 'torgen', 'id', 'cryptic_clues')
  , Meteor.Error));
  
  describe('to puzzle with empty mechanics', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 2,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      tags: { status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    }}));
        
    it('fails without login', () => chai.assert.throws(() => Meteor.call('addMechanic', id, 'cryptic_clues')
    , Match.Error));
        
    return describe('when logged in', function() {
      beforeEach(() => callAs('addMechanic', 'cjb', id, 'cryptic_clues'));

      it('appends mechanic', function() {
        const doc = Puzzles.findOne(id);
        return chai.assert.deepInclude(doc, {mechanics: ['cryptic_clues']});
    });

      return it('touches', function() {
        const doc = Puzzles.findOne(id);
        return chai.assert.include(doc, {
          touched: 7,
          touched_by: 'cjb'
        }
        );
      });
    });
  });
  
  return describe('to puzzle with mechanics', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 2,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      tags: { status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    },
      mechanics: ['nikoli_variants']}));
        
    it('fails without login', () => chai.assert.throws(() => Meteor.call('addMechanic', id, 'cryptic_clues')
    , Match.Error));
        
    return describe('when logged in', function() {
      it('fails with invalid mechanic', () => chai.assert.throws(() => callAs('addMechanic', 'torgen', id, 'eating_contest')
      , Match.Error));

      describe('with new mechanic', function() {
        beforeEach(() => callAs('addMechanic', 'cjb', id, 'cryptic_clues'));

        it('appends mechanic', function() {
          const doc = Puzzles.findOne(id);
          return chai.assert.deepInclude(doc, {mechanics: ['nikoli_variants', 'cryptic_clues']});
      });

        return it('touches', function() {
          const doc = Puzzles.findOne(id);
          return chai.assert.include(doc, {
            touched: 7,
            touched_by: 'cjb'
          }
          );
        });
      });

      return describe('with existing mechanic', function() {
        beforeEach(() => callAs('addMechanic', 'cjb', id, 'nikoli_variants'));

        it('leaves mechanics unchanged', function() {
          const doc = Puzzles.findOne(id);
          return chai.assert.deepInclude(doc, {mechanics: ['nikoli_variants']});
      });

        return it('touches', function() {
          const doc = Puzzles.findOne(id);
          return chai.assert.include(doc, {
            touched: 7,
            touched_by: 'cjb'
          }
          );
        });
      });
    });
  });
});
