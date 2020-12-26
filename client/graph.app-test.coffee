'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'
import denodeify from 'denodeify'

describe 'graph', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')

  after ->
    logout()

  it 'renders', ->
    share.Router.GraphPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    await new Promise (resolve) ->
      $('.bb-status-graph').one('render', resolve)
    chai.assert.isAtLeast $('.bb-status-graph canvas').length, 1
