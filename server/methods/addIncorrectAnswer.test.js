// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects 
import '/lib/model.coffee';
import { CallIns, Messages, Puzzles } from '/lib/imports/collections.coffee';
// Test only works on server side; move to /server if you add client tests.
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('addIncorrectAnswer', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());
    
  it('fails when it doesn\'t exist', () => chai.assert.throws(() => callAs('addIncorrectAnswer', 'torgen', {
    target: 'something',
    answer: 'precipitate'
  }
  )
  , Meteor.Error));
  
  return describe('which exists', function() {
    let id = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'torgen',
        solved: null,
        solved_by: null,
        tags: { status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
      }});
      return CallIns.insert({
        target_type: 'puzzles',
        target: id,
        name: 'Foo',
        answer: 'flimflam',
        created: 4,
        created_by: 'cjb',
        callin_type: 'answer',
        status: 'pending'
      });
    });
        
    it('fails without login', () => chai.assert.throws(() => Meteor.call('addIncorrectAnswer', {
      target: id,
      answer: 'flimflam'
    }
    )
    , Match.Error));
        
    return describe('when logged in', function() {
      beforeEach(() => callAs('addIncorrectAnswer', 'cjb', {
        target: id,
        answer: 'flimflam'
      }
      ));

      it('doesn\'t touch', function() {
        const doc = Puzzles.findOne(id);
        return chai.assert.include(doc, {
          touched: 2,
          touched_by: 'torgen'
        }
        );
      });

      it('oplogs', function() {
        const o = Messages.find({room_name: 'oplog/0'}).fetch();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          type: 'puzzles',
          id,
          stream: 'callins',
          nick: 'cjb'
        }
        );
        // oplog is lowercase
        return chai.assert.include(o[0].body, 'flimflam', 'message');
      });

      return it('updates callin', () => chai.assert.include(CallIns.findOne(),
        {status: 'rejected'}));
    });
  });
});
