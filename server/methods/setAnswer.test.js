// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.js';
import { CallIns, Messages, Presence, Puzzles } from '/lib/imports/collections.js';
import { callAs } from '/server/imports/impersonate.js';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('setAnswer', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  describe('without answer', function() {
    let id = null;
    let ret = null;
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
        confirmed_by: null,
        solverTime: 14,
        tags: { technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      }});
      Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'torgen',
        timestamp: 2,
        scope: 'chat'
      });
      Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'botto',
        timestamp: 0,
        bot: true,
        scope: 'chat'
      });
      return Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'idle',
        timestamp: -130001,
        scope: 'chat'
      });
    });
    it('fails without login', () => chai.assert.throws(() => Meteor.call('setAnswer', {
      target: id,
      answer: 'bar'
    }
    )
    , Match.Error));

    return describe('when logged in', function() {
      ret = null;
      beforeEach(() => ret = callAs('setAnswer', 'cjb', {
        target: id,
        answer: 'bar'
      }
      ));

      it('returns true', () => chai.assert.isTrue(ret));

      it('modifies document', () => chai.assert.deepEqual(Puzzles.findOne(id), {
        _id: id,
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 7,
        touched_by: 'cjb',
        solved: 7,
        solved_by: 'cjb',
        confirmed_by: 'cjb',
        solverTime: 70027,
        tags: {
          answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'},
          technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
        }
      }));
      
      return it('oplogs', function() {
        const oplogs = Messages.find({room_name: 'oplog/0'}).fetch();
        chai.assert.equal(oplogs.length, 1);
        return chai.assert.include(oplogs[0], {
          nick: 'cjb',
          timestamp: 7,
          type: 'puzzles',
          id,
          oplog: true,
          action: true,
          stream: 'answers'
        }
        );
      });
    });
  });

  describe('with answer', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'torgen',
        solved: 2,
        solved_by: 'cscott',
        confirmed_by: 'torgen',
        solverTime: 0,
        tags: {
          answer: {name: 'Answer', value: 'qux', touched: 2, touched_by: 'torgen'},
          technology:{name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
        }});
      return ret = callAs('setAnswer', 'cjb', {
        target: id,
        answer: 'bar'
      }
      );
    });
    
    it('returns true', () => chai.assert.isTrue(ret));

    it('modifies document', () => chai.assert.deepEqual(Puzzles.findOne(id), {
      _id: id,
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 7,
      touched_by: 'cjb',
      solved: 7,
      solved_by: 'cjb',
      confirmed_by: 'cjb',
      solverTime: 0,
      tags: {
        answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'},
        technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      }
    }));
    
    return it('oplogs', function() {
      const oplogs = Messages.find({room_name: 'oplog/0'}).fetch();
      chai.assert.equal(oplogs.length, 1);
      return chai.assert.include(oplogs[0], {
        nick: 'cjb',
        timestamp: 7,
        bodyIsHtml: false,
        type: 'puzzles',
        id,
        oplog: true,
        action: true,
        stream: 'answers'
      }
      );
    });
  });

  describe('with same answer', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'torgen',
        solved: 2,
        solved_by: 'cscott',
        confirmed_by: 'torgen',
        solverTime: 14,
        tags: {
          answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'},
          technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
        }});
      Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'torgen',
        timestamp: 2,
        present: true
      });
      Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'botto',
        timestamp: 0,
        bot: true,
        scope: 'chat'
      });
      Presence.insert({
        room_name: `puzzles/${id}`,
        nick: 'idle',
        timestamp: -130001,
        scope: 'chat'
      });
      return ret = callAs('setAnswer', 'cjb', {
        target: id,
        answer: 'bar'
      }
      );
    });

    it('returns false', () => chai.assert.isFalse(ret));

    it('leaves document alone', () => chai.assert.deepEqual(Puzzles.findOne(id), {
      _id: id,
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 2,
      touched_by: 'torgen',
      solved: 2,
      solved_by: 'cscott',
      confirmed_by: 'torgen',
      solverTime: 14,
      tags: {
        answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'},
        technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
      }
    }));

    return it('doesn\'t oplog', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0'}).fetch(), 0));
  });

  it('modifies tags', function() {
    const id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 2,
      touched_by: 'torgen',
      solved: null,
      solved_by: null,
      confirmed_by: null,
      tags: { status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    }});
    chai.assert.isTrue(callAs('setAnswer', 'cjb', {
      target: id,
      answer: 'bar',
      backsolve: true,
      provided: true
    }
    )
    );
    return chai.assert.deepInclude(Puzzles.findOne(id), {
      tags: {
        answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'},
        backsolve: {name: 'Backsolve', value: 'yes', touched: 7, touched_by: 'cjb'},
        provided: {name: 'Provided', value: 'yes', touched: 7, touched_by: 'cjb'}
      }
    });
});

  return describe('with matching callins', function() {
    let id = null;
    let cid1 = null;
    let cid2 = null;
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
        confirmed_by: null,
        tags: {}});
      cid1 = CallIns.insert({
        target_type: 'puzzles',
        target: id,
        name: 'Foo',
        answer: 'bar',
        callin_type: 'answer',
        created: 5,
        created_by: 'codexbot',
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: 'pending'
      });
      cid2 = CallIns.insert({
        target_type: 'puzzles',
        target: id,
        name: 'Foo',
        answer: 'qux',
        callin_type: 'answer',
        created: 5,
        created_by: 'codexbot',
        submitted_to_hq: false,
        backsolve: false,
        provided: false,
        status: 'pending'
      });
      return callAs('setAnswer', 'cjb', {
        target: id,
        answer: 'bar'
      }
      );
    });
        
    it('updates callins', function() {
      chai.assert.include(CallIns.findOne(cid1), {
        status: 'accepted',
        resolved: 7
      }
      );
      return chai.assert.include(CallIns.findOne(cid2), {
        status: 'cancelled',
        resolved: 7
      }
      );
    });

    it('doesn\'t oplog for callins', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', type: 'callins'}).fetch(), 0));

    it('oplogs for puzzle', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', type: 'puzzles', id}).fetch(), 1));

    return it('sets solved_by correctly', () => chai.assert.deepInclude(Puzzles.findOne(id), {
      solved: 7,
      solved_by: 'codexbot',
      confirmed_by: 'cjb'
    }
    ));
  });
});
