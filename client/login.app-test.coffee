'use strict'

import {waitForMethods, waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'login', ->
  @timeout 10000
  it 'only sends email hash', ->
    await login 'testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase'
    await waitForSubscriptions()
    chai.assert.isUndefined Meteor.users.findOne('testy').gravatar
    chai.assert.equal Meteor.users.findOne('testy').gravatar_md5, 'a24f643d34150c3b4053989db38251c9'

  it 'requires matching password', ->
    try
      await login 'testy', 'Teresa Tybalt', 'fake@artifici.al', 'succeedphoneme'
    catch e
      chai.assert.deepEqual e.details, field: 'password'
      return
    chai.assert.fail()

  describe 'through UI', ->
    it 'highlights password field when wrong', ->
      $('#passwordInput').val('succeedphoneme')
      $('#nickInput').val('testy').trigger('input')
      await afterFlushPromise()
      chai.assert.isOk $('.bb-submit')[0]
      $('.bb-submit').click()
      await waitForMethods()
      chai.assert.isNotOk Meteor.userId()
      chai.assert.isTrue $('#passwordInputGroup')[0].classList.contains 'error'
      chai.assert.equal $('#loginError')[0].innerText, 'Wrong password'

    it 'highlights nick field when too long', ->
      $('#passwordInput').val('failphrase')
      $('#nickInput').val('thisisovertwentycharacterslong').trigger('input')
      await afterFlushPromise()
      chai.assert.isOk $('.bb-submit')[0]
      $('.bb-submit').click()
      await waitForMethods()
      chai.assert.isNotOk Meteor.userId()
      chai.assert.isTrue $('#nickInputGroup')[0].classList.contains 'error'
      chai.assert.equal $('#loginError')[0].innerText, 'Nickname must be 1-20 characters long'

    it 'highlights nick field when matches bot', ->
      $('#passwordInput').val('failphrase')
      $('#nickInput').val('codexbot').trigger('input')
      await afterFlushPromise()
      chai.assert.isOk $('.bb-submit')[0]
      $('.bb-submit').click()
      await waitForMethods()
      chai.assert.isNotOk Meteor.userId()
      chai.assert.isTrue $('#nickInputGroup')[0].classList.contains 'error'
      chai.assert.equal $('#loginError')[0].innerText, 'Can\'t impersonate the bot'

    it 'logs in', ->
      $('#passwordInput').val('failphrase')
      $('#nickInput').val('testy').trigger('input')
      await afterFlushPromise()
      chai.assert.isOk $('.bb-submit')[0]
      $('.bb-submit').click()
      await waitForMethods()
      chai.assert.equal Meteor.userId(), 'testy'

  afterEach ->
    logout()
