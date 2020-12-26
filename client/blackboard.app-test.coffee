'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'blackboard', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  it 'renders in readonly mode', ->
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    # there should be a table header for the Civilization round.
    civId = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isNotNull $("##{civId._id}").html()

  it 'renders in edit mode', ->
    share.Router.EditPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    # there should be a table header for the Civilization round.
    civId = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isNotNull $("##{civId._id}").html()

