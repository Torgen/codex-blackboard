'use strict'

import { FlowRouter } from 'meteor/ostrio:flow-router-extra'
import {waitForSubscriptions, waitForMethods, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'quips', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  describe 'new', ->
    beforeEach ->
      FlowRouter.go 'Quip', {id: 'new'}
      await waitForSubscriptions()
      await afterFlushPromise()

    it 'renders', ->
      chai.assert.notEmpty $('.bb-quip-text')

    it 'creates', ->
      $('.bb-add-new-quip textarea').val('Codex is my co-dump stat.')
      $('.bb-add-new-quip button').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.notEqual Session.get('id'), 'new'
      chai.assert.equal $('h2').text(), 'Quip: Parker Tremaine'
