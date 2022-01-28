'use strict'

import { FlowRouter } from 'meteor/ostrio:flow-router-extra'
import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'callins', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  it 'marks puzzle solved', ->
    FlowRouter.go 'CallIns'
    await waitForSubscriptions()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    chai.assert.isNotOk pb.tags.answer
    await promiseCall 'newCallIn',
      callin_type: 'answer'
      target_type: 'puzzles'
      target: pb._id
      answer: 'teferi'
    await afterFlushPromise()
    correctButtons = $('.bb-callin-correct')
    chai.assert.equal correctButtons.length, 1
    correctButtons.click()
    await waitForMethods()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isOk pb.solved
    chai.assert.equal pb.tags.answer.value, 'teferi'
