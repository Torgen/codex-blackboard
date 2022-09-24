// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.js';
import { Messages, Puzzles } from '/lib/imports/collections.js';
import { callAs } from '/server/imports/impersonate.js';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('summon', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  describe('when already answered', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'cjb',
        solved: 2,
        solved_by: 'cjb',
        tags: { answer: {name: 'Answer', value: 'precipitate', touched: 2, touched_by: 'cjb'}
      }});
      return ret = callAs('summon', 'torgen', {object: id});
    });

    it('returns an error', () => chai.assert.isString(ret));

    it('doesn\'t touch', () => chai.assert.deepInclude(Puzzles.findOne(id), {
      touched: 2,
      touched_by: 'cjb',
      solved: 2,
      solved_by: 'cjb',
      tags: { answer: {name: 'Answer', value: 'precipitate', touched: 2, touched_by: 'cjb'}
    }
    }));

    it('doesn\'t chat', () => chai.assert.lengthOf(Messages.find({room_name: {$ne: 'oplog/0'}}).fetch(), 0));

    return it('doesn\'t oplog', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0'}).fetch(), 0));
  });

  describe('when already stuck', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'cjb',
        solved: null,
        solved_by: null,
        tags: { status: {name: 'Status', value: 'Stuck on you', touched: 2, touched_by: 'cjb'}
      }});
      return ret = callAs('summon', 'torgen', {
        object: id,
        how: 'Stuck like glue'
      }
      );
    });
    it('returns nothing', () => chai.assert.isUndefined(ret));

    it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
      touched: 7,
      touched_by: 'torgen',
      tags: { status: {name: 'Status', value: 'Stuck like glue', touched: 7, touched_by: 'torgen'}
    }
    }));

    it('doesn\'t chat', () => chai.assert.lengthOf(Messages.find({room_name: {$ne: 'oplog/0'}}).fetch(), 0));

    return it('doesn\'t oplog', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0'}).fetch(), 0));
  });

  describe('with other status', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'cjb',
        solved: null,
        solved_by: null,
        tags: { status: {name: 'Status', value: 'everything is fine', touched: 2, touched_by: 'cjb'}
      }});
      return ret = callAs('summon', 'torgen', {
        object: id,
        how: 'Stuck like glue'
      }
      );
    });
    it('returns nothing', () => chai.assert.isUndefined(ret));

    it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
      touched: 7,
      touched_by: 'torgen',
      tags: { status: {name: 'Status', value: 'Stuck like glue', touched: 7, touched_by: 'torgen'}
    }
    }));

    it('notifies main chat', function() {
      const msgs = Messages.find({room_name: 'general/0', dawn_of_time: {$ne: true}}).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ': Stuck like glue (');
      chai.assert.include(msgs[0].body, 'Foo');
      return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
    });

    it("notifies puzzle chat", function() {
      const msgs = Messages.find({room_name: `puzzles/${id}`, dawn_of_time: {$ne: true}}).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ': Stuck like glue');
      chai.assert.notInclude(msgs[0].body, 'Foo');
      return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
    });

    return it('oplogs', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', stream: 'stuck', type: 'puzzles', id}).fetch(), 1));
  });

  describe('with no status', function() {
    let id = null;
    beforeEach(() => id = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      created: 1,
      created_by: 'cscott',
      touched: 2,
      touched_by: 'cjb',
      solved: null,
      solved_by: null,
      tags: {}}));

    it('fails without login', () => chai.assert.throws(function() {
      let ret;
      return ret = Meteor.call('summon', {object: id});
    }
    , Match.Error));

    describe('empty how', function() {
      let ret = null;
      beforeEach(() => ret = callAs('summon', 'torgen', {object: id}));

      it('returns nothing', () => chai.assert.isUndefined(ret));

      it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
        touched: 7,
        touched_by: 'torgen',
        tags: { status: {name: 'Status', value: 'Stuck', touched: 7, touched_by: 'torgen'}
      }
      }));

      it('notifies main chat', function() {
        const msgs = Messages.find({room_name: 'general/0', dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': Stuck (');
        chai.assert.include(msgs[0].body, 'Foo');
        return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
      });

      it("notifies puzzle chat", function() {
        const msgs = Messages.find({room_name: `puzzles/${id}`, dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': Stuck');
        chai.assert.notInclude(msgs[0].body, 'Foo');
        return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
      });

      return it('oplogs', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', stream: 'stuck', type: 'puzzles', id}).fetch(), 1));
    });
        
    describe('how starts with stuck', function() {
      let ret = null;
      beforeEach(() => ret = callAs('summon', 'torgen', {
        object: id,
        how: 'stucK like glue'
      }
      ));

      it('returns nothing', () => chai.assert.isUndefined(ret));

      it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
        touched: 7,
        touched_by: 'torgen',
        tags: { status: {name: 'Status', value: 'stucK like glue', touched: 7, touched_by: 'torgen'}
      }
      }));

      it('notifies main chat', function() {
        const msgs = Messages.find({room_name: 'general/0', dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': stucK like glue (');
        chai.assert.include(msgs[0].body, 'Foo');
        return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
      });

      it("notifies puzzle chat", function() {
        const msgs = Messages.find({room_name: `puzzles/${id}`, dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': stucK like glue');
        chai.assert.notInclude(msgs[0].body, 'Foo');
        return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
      });

      return it('oplogs', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', stream: 'stuck', type: 'puzzles', id}).fetch(), 1));
    });

    return describe('how starts with other', function() {
      let ret = null;
      beforeEach(() => ret = callAs('summon', 'torgen', {
        object: id,
        how: 'no idea'
      }
      ));

      it('returns nothing', () => chai.assert.isUndefined(ret));

      it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
        touched: 7,
        touched_by: 'torgen',
        tags: { status: {name: 'Status', value: 'Stuck: no idea', touched: 7, touched_by: 'torgen'}
      }
      }));

      it('notifies main chat', function() {
        const msgs = Messages.find({room_name: 'general/0', dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': no idea (');
        chai.assert.notInclude(msgs[0].body, 'Stuck');
        chai.assert.notInclude(msgs[0].body, 'solver-minutes');
        return chai.assert.include(msgs[0].body, 'Foo');
      });

      it("notifies puzzle chat", function() {
        const msgs = Messages.find({room_name: `puzzles/${id}`, dawn_of_time: {$ne: true}}).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ': no idea');
        chai.assert.notInclude(msgs[0].body, 'Stuck');
        chai.assert.notInclude(msgs[0].body, 'Foo');
        return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
      });

      return it('oplogs', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', stream: 'stuck', type: 'puzzles', id}).fetch(), 1));
    });
  });
  
  return describe('with solver time', function() {
    let id = null;
    let ret = null;
    beforeEach(function() {
      id = Puzzles.insert({
        name: 'Foo',
        canon: 'foo',
        created: 1,
        created_by: 'cscott',
        touched: 2,
        touched_by: 'cjb',
        solved: null,
        solved_by: null,
        solverTime: 1920004,
        tags: { status: {name: 'Status', value: 'everything is fine', touched: 2, touched_by: 'cjb'}
      }});
      return ret = callAs('summon', 'torgen', {
        object: id,
        how: 'Stuck like glue'
      }
      );
    });
    it('returns nothing', () => chai.assert.isUndefined(ret));

    it('updates document', () => chai.assert.deepInclude(Puzzles.findOne(id), {
      touched: 7,
      touched_by: 'torgen',
      tags: { status: {name: 'Status', value: 'Stuck like glue', touched: 7, touched_by: 'torgen'}
    }
    }));

    it('notifies main chat', function() {
      const msgs = Messages.find({room_name: 'general/0', dawn_of_time: {$ne: true}}).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ': Stuck like glue (');
      chai.assert.include(msgs[0].body, 'Foo');
      return chai.assert.include(msgs[0].body, '32 solver-minutes');
    });

    it("notifies puzzle chat", function() {
      const msgs = Messages.find({room_name: `puzzles/${id}`, dawn_of_time: {$ne: true}}).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ': Stuck like glue');
      chai.assert.notInclude(msgs[0].body, 'Foo');
      return chai.assert.notInclude(msgs[0].body, 'solver-minutes');
    });

    return it('oplogs', () => chai.assert.lengthOf(Messages.find({room_name: 'oplog/0', stream: 'stuck', type: 'puzzles', id}).fetch(), 1));
  });
});
