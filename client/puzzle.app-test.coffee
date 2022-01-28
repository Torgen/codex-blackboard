'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from '/client/imports/app_test_helpers.coffee'
import chai from 'chai'

modalHiddenPromise = -> new Promise (resolve) -> $('#callin_modal').one 'hidden', resolve

describe 'puzzle', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
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
      id = share.model.Puzzles.findOne(name: 'Cross Words')._id

    it 'renders puzzle view', ->
      share.Router.PuzzlePage id, 'puzzle'
      await waitForSubscriptions()
      await afterFlushPromise()

    it 'renders info view', ->
      share.Router.PuzzlePage id, 'info'
      await waitForSubscriptions()
      await afterFlushPromise()

  describe 'callin modal', ->
    id = null
    callin = null
    beforeEach ->
      await waitForSubscriptions()
      id = share.model.Puzzles.findOne(name: 'Cross Words')._id
      share.Router.PuzzlePage id, 'puzzle'
      await waitForSubscriptions()
      await afterFlushPromise()

    afterEach ->
      await promiseCall 'cancelCallIn', id: callin._id
      callin = null
    
    it 'creates answer callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrr'
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrr'
        callin_type: 'answer'
        created_by: 'testy'
        backsolve: false
        provided: false
    
    it 'creates backsolve callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrrr'
      $('input[value="backsolve"]').prop 'checked', true
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrrr'
        callin_type: 'answer'
        created_by: 'testy'
        backsolve: true
        provided: false
    
    it 'creates provided callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrrrr'
      $('input[value="provided"]').prop 'checked', true
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrrrr'
        callin_type: 'answer'
        created_by: 'testy'
        backsolve: false
        provided: true
    
    it 'creates expected callback callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrrrrr'
      $('input[value="expected callback"]').prop('checked', true).change()
      await afterFlushPromise()
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrrrrr'
        callin_type: 'expected callback'
        created_by: 'testy'
        backsolve: false
        provided: false
    
    it 'creates message to hq callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrrrrrr'
      $('input[value="message to hq"]').prop('checked', true).change()
      await afterFlushPromise()
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrrrrrr'
        callin_type: 'message to hq'
        created_by: 'testy'
        backsolve: false
        provided: false
    
    it 'creates interaction request callin', ->
      $('.bb-callin-btn').click()
      $('.bb-callin-answer').val 'grrrrrrrr'
      $('input[value="interaction request"]').prop('checked', true).change()
      await afterFlushPromise()
      p = modalHiddenPromise()
      $('.bb-callin-submit').click()
      await p
      await waitForMethods()
      callin = share.model.CallIns.findOne({target: id, status: 'pending'})
      chai.assert.deepInclude callin,
        answer: 'grrrrrrrr'
        callin_type: 'interaction request'
        created_by: 'testy'
        backsolve: false
        provided: false
