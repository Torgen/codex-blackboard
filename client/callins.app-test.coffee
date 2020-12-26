'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'callins', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  it 'renders table', ->
    share.Router.CallInPage()
    await waitForSubscriptions()
    # there should be a table header for the Civilization round.
    chai.assert.isNotNull $("bb-callin-table").html()