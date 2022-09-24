// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Puzzles, Rounds } from '/lib/imports/collections.js';
import * as notification from '/client/imports/notification.js';
import Router from '/client/imports/router.js';
import {waitForMethods, waitForSubscriptions, promiseCall, promiseCallOn, afterFlushPromise, login, logout} from './imports/app_test_helpers.js';
import chai from 'chai';
import sinon from 'sinon';
import delay from 'delay';

const GRAVATAR_192 = 'https://secure.gravatar.com/avatar/ec59d144f959e61bdf692ff0eb379d67.jpg?d=wavatar&s=192';

describe('notifications dropdown', function() {
  this.timeout(10000);
  before(async function() {
    await login('testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase');
    return Router.BlackboardPage();
  });

  after(() => logout());

  return it('enables and disables clicked streams', async function() {
    Session.set('notifications', 'granted');
    await afterFlushPromise();
    try {
      chai.assert.equal($('.bb-notification-controls').css('display'), 'none');
      $('.bb-notification-enabled + .dropdown-toggle').click();
      chai.assert.equal($('.bb-notification-controls').css('display'), 'block');
      chai.assert.isFalse($('input[data-notification-stream="new-puzzles"').prop('checked'));
      chai.assert.notEqual(localStorage.getItem('notification.stream.new-puzzles'), 'true');
      $('input[data-notification-stream="new-puzzles"').click();
      await afterFlushPromise();
      chai.assert.equal($('.bb-notification-controls').css('display'), 'block');
      chai.assert.isTrue($('input[data-notification-stream="new-puzzles"').prop('checked'));
      chai.assert.equal(localStorage.getItem('notification.stream.new-puzzles'), 'true');
      $('input[data-notification-stream="new-puzzles"').click();
      await afterFlushPromise();
      chai.assert.equal($('.bb-notification-controls').css('display'), 'block');
      chai.assert.isFalse($('input[data-notification-stream="new-puzzles"').prop('checked'));
      chai.assert.notEqual(localStorage.getItem('notification.stream.new-puzzles'), 'true');
      $('body').click();
      return chai.assert.equal($('.bb-notification-controls').css('display'), 'none');
    } finally {
      Session.set('notifications', 'default');
    }
  });
});

describe('notifications', function() {
  this.timeout(10000);
  let other_conn = null;
  before(async function() {
    await login('testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase');
    other_conn = DDP.connect(Meteor.absoluteUrl());
    await promiseCallOn(other_conn, 'login', {
      nickname: 'someoneelse',
      real_name: 'Someone Else',
      password: 'failphrase'
    }
    );
    return Router.BlackboardPage();
  });
  
  after(() => logout());
  
  after(() => other_conn.disconnect());

  const testcase = (name, stream, title, settings, setup, cleanup) => describe(name, function() {
    let mock = null;
    beforeEach(() => mock = sinon.mock(notification));

    afterEach(() => mock.verify());

    it('does not notify when granted but not enabled', async function() {
      let v = null;
      try {
        Session.set('notifications', 'granted');
        notification.set(stream, false);
        mock.expects('notify').never();
        await afterFlushPromise();
        await waitForSubscriptions();
        v = await setup();
        return await delay(1000);
      } finally {
        if (v != null) { await cleanup(v); }
        Session.set('notifications', 'default');
      }
    });

    it('does not notify when not granted ', async function() {
      let v = null;
      try {
        Session.set('notifications', 'denied');
        notification.set(stream, true);
        mock.expects('notify').never();
        await afterFlushPromise();
        await waitForSubscriptions();
        v = await setup();
        return await delay(1000);
      } finally {
        if (v != null) { await cleanup(v); }
        Session.set('notifications', 'default');
        notification.set(stream, false);
      }
    });

    return it('notifies when enabled', async function() {
      let v = null;
      try {
        Session.set('notifications', 'granted');
        notification.set(stream, true);
        const notify = mock.expects('notify');
        const p = new Promise(resolve => notify.once().callsFake(() => resolve()));
        await afterFlushPromise();
        await waitForSubscriptions();
        v = await setup();
        await p;
        return sinon.assert.calledWith(notify, title(v), settings(v));
      } finally {
        if (v != null) { await cleanup(v); }
        Session.set('notifications', 'default');
        notification.set(stream, false);
      }
    });
  });

  testcase('starred in main', 'announcements', (() => 'Announcement by someoneelse'), (() => sinon.match({body: 'what\'s up guys', icon: GRAVATAR_192})), async function() {
    const msg = await promiseCallOn(other_conn, 'newMessage', {body: 'what\'s up guys'});
    return promiseCallOn(other_conn, 'setStarred', msg._id, true);
  }
  , function() {});

  testcase('new puzzle', 'new-puzzles', (() => 'someoneelse'), (v => sinon.match({body: 'Added puzzle Test Notification', icon: GRAVATAR_192, data: {url: `/puzzles/${v}`}})), async function() {
    const round = Rounds.findOne({name: 'Civilization'});
    const obj = await promiseCallOn(other_conn, 'newPuzzle', {
      name: 'Test Notification',
      round: round._id
    }
    );
    return obj._id;
  }
  , id => promiseCallOn(other_conn, 'deletePuzzle', id));

  testcase('new round', 'new-puzzles', (() => 'someoneelse'), (v => sinon.match({body: 'Added round Test Notification', icon: GRAVATAR_192, data: {url: `/rounds/${v}`}})), async function() {
    const obj = await promiseCallOn(other_conn, 'newRound',
      {name: 'Test Notification'});
    return obj._id;
  }
  , id => promiseCallOn(other_conn, 'deleteRound', id));

  testcase('new callin', 'callins', (() => 'someoneelse'), (() => sinon.match({body: 'New answer knob submitted for puzzle The Doors Of Cambridge', icon: GRAVATAR_192, data: {url: "/logistics"}})), async function() {
    const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
    const obj = await promiseCallOn(other_conn, 'newCallIn', {
      target: doors._id,
      answer: 'knob'
    }
    );
    return obj._id;
  }
  , id => promiseCallOn(other_conn, 'cancelCallIn', {id}));

  testcase('answer', 'answers', (() => 'someoneelse'), (id => sinon.match({body: 'Found an answer (KNOB) to puzzle The Doors Of Cambridge', icon: GRAVATAR_192, data: {url: `/puzzles/${id}`}})), async function() {
    const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
    await promiseCallOn(other_conn, 'setAnswer', {
      target: doors._id,
      answer: 'knob'
    }
    );
    return doors._id;
  }
  , id => promiseCallOn(other_conn, 'deleteAnswer', {target: id}));

  testcase('mechanics', 'favorite-mechanics', (() => 'The Doors Of Cambridge'), (id => sinon.match({body: 'Mechanic "Nikoli Variants" added to puzzle "The Doors Of Cambridge"', tag: `${id}/nikoli_variants`, data: {url: `/puzzles/${id}`}})), async function() {
    await promiseCall('favoriteMechanic', 'nikoli_variants');
    const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
    await promiseCallOn(other_conn, 'addMechanic', doors._id, 'nikoli_variants');
    return doors._id;
  }
  , async function(id) {
    await promiseCall('unfavoriteMechanic', 'nikoli_variants');
    return promiseCall('removeMechanic', id, 'nikoli_variants');
  });

  testcase('private message', 'private-messages', (() => 'Private message from someoneelse in Puzzle "The Doors Of Cambridge"'), (({id, rand}) => sinon.match({body: `How you doin ${rand}`, icon: GRAVATAR_192, data: {url: `/puzzles/${id}`}})), async function() {
    const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
    const rand = Random.id();
    await promiseCallOn(other_conn, 'newMessage', {
      room_name: `puzzles/${doors._id}`,
      to: 'testy',
      body: `How you doin ${rand}`
    }
    );
    return {id: doors._id, rand};
  }
  , function() {});

  return testcase('mention', 'private-messages', (() => 'Mentioned by someoneelse in Puzzle "The Doors Of Cambridge"'), (({id, rand}) => sinon.match({body: `@testy How you doin ${rand}`, icon: GRAVATAR_192, data: {url: `/puzzles/${id}`}})), async function() {
    const doors = Puzzles.findOne({name: 'The Doors Of Cambridge'});
    const rand = Random.id();
    await promiseCallOn(other_conn, 'newMessage', {
      room_name: `puzzles/${doors._id}`,
      mention: ['testy'],
      body: `@testy How you doin ${rand}`
    }
    );
    return {id: doors._id, rand};
  }
  , function() {});
});


        