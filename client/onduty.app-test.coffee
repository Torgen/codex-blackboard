'use strict'

import {waitForMethods, waitForSubscriptions, promiseCall, promiseCallOn, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import {waitForDeletion} from '/lib/imports/testutils.coffee'
import chai from 'chai'
import { reactiveLocalStorage } from './imports/storage.coffee'

describe 'onduty', ->
  @timeout 20000

  afterEach  ->
    logout()

  it 'updates while logged in', ->
    await login('testy', 'Teresa Tybalt', '', 'failphrase')
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    $('[data-onduty="claim"]').click()
    await waitForMethods()
    await afterFlushPromise()
    chai.assert.deepInclude share.model.Roles.findOne('onduty'),
      holder: 'testy'
    chai.assert.deepInclude Meteor.users.findOne('testy'),
      roles: ['onduty']
    $('[data-onduty="release"]').click()
    await waitForMethods()
    chai.assert.isNotOk share.model.Roles.findOne('onduty')
    chai.assert.doesNotHaveAnyKeys Meteor.users.findOne('testy'), ['roles']

  it 'Sends existing value when logged in', ->
    other_conn = DDP.connect Meteor.absoluteUrl()
    await promiseCallOn other_conn, 'login',
      nickname: 'incognito'
      real_name: 'Mister Snrub'
      password: 'failphrase'
    await promiseCallOn other_conn, 'claimOnduty',
      from: null
    await login('testy', 'Teresa Tybalt', '', 'failphrase')
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    chai.assert.deepInclude share.model.Roles.findOne('onduty'),
      holder: 'incognito'
    chai.assert.deepInclude Meteor.users.findOne('incognito'),
      roles: ['onduty']
    wait = waitForDeletion share.model.Roles, 'onduty'
    await promiseCallOn other_conn, 'releaseOnduty'
    await wait
    chai.assert.doesNotHaveAnyKeys Meteor.users.findOne('incognito'), ['roles']
    other_conn.disconnect()
