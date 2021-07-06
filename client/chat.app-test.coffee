'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'chat', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  it 'general chat', ->
    share.Router.ChatPage('general', '0')
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isDefined $('a[href^="https://codexian.us"]').html()
    chai.assert.isDefined $('img[src^="https://memegen.link/doge"]').html()

  it 'puzzle chat', ->
    id = share.model.Puzzles.findOne(name: 'Temperance')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    afterFlushPromise()