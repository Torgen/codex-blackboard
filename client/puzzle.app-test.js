/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { CallIns, Puzzles } from '/lib/imports/collections.coffee';
import Router from '/client/imports/router.coffee';
import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee';
import chai from 'chai';

const modalHiddenPromise = () => new Promise(resolve => $('#callin_modal').one('hidden', resolve));

describe('puzzle', function() {
  this.timeout(10000);
  before(() => login('testy', 'Teresa Tybalt', '', 'failphrase'));
  
  after(() => logout());

  describe('metameta', function() {
    let id = null;
    beforeEach(async function() {
      await waitForSubscriptions();
      return id = Puzzles.findOne({name: 'Interstellar Spaceship'})._id;
    });

    it('renders puzzle view', async function() {
      Router.PuzzlePage(id, 'puzzle');
      await waitForSubscriptions();
      return await afterFlushPromise();
    });

    return describe('in info view', function() {
      beforeEach(async function() {
        Router.PuzzlePage(id, 'info');
        await waitForSubscriptions();
        return await afterFlushPromise();
      });

      it('allows modifying feeders', async function() {
        $('.unattached').click();
        await afterFlushPromise();
        const storm = Puzzles.findOne({name: 'The Brainstorm'});
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        chai.assert.include(Puzzles.findOne(id).puzzles, storm._id);
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        return chai.assert.notInclude(Puzzles.findOne(id).puzzles, storm._id);
      });

      return it('allows spilling grandfeeders', async function() {
        $('.grandfeeders').click();
        await afterFlushPromise();
        const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
        return chai.assert.lengthOf($(`[data-feeder-id=\"${doors._id}\"]`).get(), 3);
      });
    });
  });

  describe('meta', function() {

    let id = null;
    beforeEach(async function() {
      await waitForSubscriptions();
      return id = Puzzles.findOne({name: 'Anger'})._id;
    });

    it('renders puzzle view', async function() {
      Router.PuzzlePage(id, 'puzzle');
      await waitForSubscriptions();
      return await afterFlushPromise();
    });

    return describe('in info view', function() {
      beforeEach(async function() {
        Router.PuzzlePage(id, 'info');
        await waitForSubscriptions();
        return await afterFlushPromise();
      });

      it('has no grandfeeders button', () => chai.assert.isNotOk($('.grandfeeders')[0]));

      it('has feeders in order', () => chai.assert.deepEqual(Puzzles.findOne(id).puzzles, $('.bb-round-answers tr[data-feeder-id]').map(function() { return this.dataset.feederId; }).get()));

      return it('allows modifying feeders', async function() {
        $('.unattached').click();
        await afterFlushPromise();
        const storm = Puzzles.findOne({name: 'The Brainstorm'});
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        chai.assert.include(Puzzles.findOne(id).puzzles, storm._id);
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        return chai.assert.notInclude(Puzzles.findOne(id).puzzles, storm._id);
      });
    });
  });

  describe('leaf', function() {

    let id = null;
    beforeEach(async function() {
      await waitForSubscriptions();
      return id = Puzzles.findOne({name: 'Cross Words'})._id;
    });

    it('renders puzzle view', async function() {
      Router.PuzzlePage(id, 'puzzle');
      await waitForSubscriptions();
      return await afterFlushPromise();
    });

    return it('renders info view', async function() {
      Router.PuzzlePage(id, 'info');
      await waitForSubscriptions();
      return await afterFlushPromise();
    });
  });

  return describe('callin modal', function() {
    let id = null;
    let callin = null;
    beforeEach(async function() {
      await waitForSubscriptions();
      id = Puzzles.findOne({name: 'Cross Words'})._id;
      Router.PuzzlePage(id, 'puzzle');
      await waitForSubscriptions();
      return await afterFlushPromise();
    });

    afterEach(async function() {
      await promiseCall('cancelCallIn', {id: callin._id});
      return callin = null;
    });
    
    it('creates answer callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrr');
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrr',
        callin_type: 'answer',
        created_by: 'testy',
        backsolve: false,
        provided: false
      }
      );
    });
    
    it('creates backsolve callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrrr');
      $('input[value="backsolve"]').prop('checked', true);
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrrr',
        callin_type: 'answer',
        created_by: 'testy',
        backsolve: true,
        provided: false
      }
      );
    });
    
    it('creates provided callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrrrr');
      $('input[value="provided"]').prop('checked', true);
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrrrr',
        callin_type: 'answer',
        created_by: 'testy',
        backsolve: false,
        provided: true
      }
      );
    });
    
    it('creates expected callback callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrrrrr');
      $('input[value="expected callback"]').prop('checked', true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrrrrr',
        callin_type: 'expected callback',
        created_by: 'testy',
        backsolve: false,
        provided: false
      }
      );
    });
    
    it('creates message to hq callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrrrrrr');
      $('input[value="message to hq"]').prop('checked', true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrrrrrr',
        callin_type: 'message to hq',
        created_by: 'testy',
        backsolve: false,
        provided: false
      }
      );
    });
    
    return it('creates interaction request callin', async function() {
      $('.bb-callin-btn').click();
      $('.bb-callin-answer').val('grrrrrrrr');
      $('input[value="interaction request"]').prop('checked', true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $('.bb-callin-submit').click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({target: id, status: 'pending'});
      return chai.assert.deepInclude(callin, {
        answer: 'grrrrrrrr',
        callin_type: 'interaction request',
        created_by: 'testy',
        backsolve: false,
        provided: false
      }
      );
    });
  });
});
