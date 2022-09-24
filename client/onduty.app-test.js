/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Roles } from '/lib/imports/collections.coffee';
import Router from '/client/imports/router.coffee';
import {waitForMethods, waitForSubscriptions, promiseCall, promiseCallOn, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee';
import {waitForDeletion} from '/lib/imports/testutils.coffee';
import chai from 'chai';
import { reactiveLocalStorage } from './imports/storage.coffee';

describe('onduty', function() {
  this.timeout(20000);

  afterEach(() => logout());

  it('updates while logged in', async function() {
    await login('testy', 'Teresa Tybalt', '', 'failphrase');
    Router.BlackboardPage();
    await waitForSubscriptions();
    $('[data-onduty="claim"]').click();
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.deepInclude(Roles.findOne('onduty'),
      {holder: 'testy'});
    chai.assert.deepInclude(Meteor.users.findOne('testy'),
      {roles: ['onduty']});
    $('[data-onduty="release"]').click();
    await waitForMethods();
    chai.assert.isNotOk(Roles.findOne('onduty'));
    return chai.assert.doesNotHaveAnyKeys(Meteor.users.findOne('testy'), ['roles']);
});

  return it('Sends existing value when logged in', async function() {
    const other_conn = DDP.connect(Meteor.absoluteUrl());
    await promiseCallOn(other_conn, 'login', {
      nickname: 'incognito',
      real_name: 'Mister Snrub',
      password: 'failphrase'
    }
    );
    await promiseCallOn(other_conn, 'claimOnduty',
      {from: null});
    await login('testy', 'Teresa Tybalt', '', 'failphrase');
    Router.BlackboardPage();
    await waitForSubscriptions();
    chai.assert.deepInclude(Roles.findOne('onduty'),
      {holder: 'incognito'});
    chai.assert.deepInclude(Meteor.users.findOne('incognito'),
      {roles: ['onduty']});
    const wait = waitForDeletion(Roles, 'onduty');
    await promiseCallOn(other_conn, 'releaseOnduty');
    await wait;
    chai.assert.doesNotHaveAnyKeys(Meteor.users.findOne('incognito'), ['roles']);
    return other_conn.disconnect();
  });
});
