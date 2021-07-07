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

  it 'updates read marker', ->
    id = share.model.Puzzles.findOne(name: 'Temperance')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isUndefined $('.bb-message-last-read').html()
    $('#messageInput').focus()
    await afterFlushPromise()
    chai.assert.isDefined $('.bb-message-last-read').html()

  it 'scrolls through history', ->
    id = share.model.Puzzles.findOne(name: 'Joy')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    input = $ '#messageInput'
    input.val '/me tests actions'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after first submit'
    input.val 'say another thing'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after second submit'
    await waitForSubscriptions()
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), 'say another thing', 'after first up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after second up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after third up'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '/me tests actions', 'after down with selection at start'
    input[0].setSelectionRange input.val().length, input.val().length
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), 'say another thing', 'after first down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after second down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after third down'
