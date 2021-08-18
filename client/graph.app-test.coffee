'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'
import denodeify from 'denodeify'

describe 'graph', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')

  after ->
    logout()

  it 'renders', ->
    share.Router.GraphPage()
    await afterFlushPromise()
    p = new Promise (resolve) ->
      $('.bb-status-graph').one('render', resolve)
    await waitForSubscriptions()
    await afterFlushPromise()
    await p
    chai.assert.isAtLeast $('.bb-status-graph canvas').length, 1
