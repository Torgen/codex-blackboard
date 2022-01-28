'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from '/client/imports/app_test_helpers.coffee'
import chai from 'chai'
import { waitForDocument } from '/lib/imports/testutils.coffee'

KRESGE = 
  type: 'Point'
  coordinates: [-71.0972017, 42.3581396]

describe 'geolocation', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  it 'moves private location to public', ->
    me = Meteor.user()
    chai.assert.isNotOk me.located_at
    chai.assert.isNotOk me.priv_located_at
    await promiseCall 'locateNick', location: KRESGE
    chai.assert.deepEqual Meteor.user().priv_located_at, KRESGE
    waitForDocument Meteor.users, {_id: 'testy', located: $ne: null},
      located_at: KRESGE
