'use strict'

import {waitForMethods, waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
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
    chai.assert.isDefined $("#round#{civId._id}").html()

  it 'renders in edit mode', ->
    share.Router.EditPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    # there should be a table header for the Civilization round.
    civId = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isDefined $("#round#{civId._id}").html()

  it 'makes a puzzle a favorite', ->
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isUndefined $('#favorites').html()
    # there should be a table header for the Civilization round.
    granary = share.model.Puzzles.findOne name: 'Granary Of Ur'
    bank = share.model.Puzzles.findOne name: 'Letter Bank'
    chai.assert.isDefined $("#m#{granary._id} tr[data-puzzle-id=\"#{bank._id}\"] .bb-favorite-button").html()
    $("#m#{granary._id} tr[data-puzzle-id=\"#{bank._id}\"] .bb-favorite-button").click()
    await waitForMethods()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isDefined $('#favorites').html()
    chai.assert.isDefined $("tr[data-puzzle-id=\"#{bank._id}\"] .bb-recent-puzzle-chat").html()

describe 'login', ->
  @timeout 10000
  it 'only sends email hash', ->
    await login 'testy', 'Teresa Tybalt', 'fake@artifici.al', ''
    await waitForSubscriptions()
    chai.assert.isUndefined Meteor.users.findOne('testy').gravatar
    chai.assert.equal Meteor.users.findOne('testy').gravatar_md5, 'a24f643d34150c3b4053989db38251c9'

  afterEach ->
    logout()
