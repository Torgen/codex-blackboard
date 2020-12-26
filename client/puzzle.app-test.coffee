'use strict'

import {waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'puzzle', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  describe 'meta', ->

    id = null
    beforeEach ->
      await waitForSubscriptions()
      id = share.model.Puzzles.findOne(name: 'Anger')._id

    it 'renders puzzle view', ->
      share.Router.PuzzlePage id, 'puzzle'
      await waitForSubscriptions()
      await afterFlushPromise()

    it 'renders info view', ->
      share.Router.PuzzlePage id, 'info'
      await waitForSubscriptions()
      await afterFlushPromise()

  describe 'leaf', ->

    id = null
    beforeEach ->
      await waitForSubscriptions()
      id = share.model.Puzzles.findOne(name: 'Temperance')._id

    it 'renders puzzle view', ->
      share.Router.PuzzlePage id, 'puzzle'
      await waitForSubscriptions()
      await afterFlushPromise()

    it 'renders info view', ->
      share.Router.PuzzlePage id, 'info'
      await waitForSubscriptions()
      await afterFlushPromise()