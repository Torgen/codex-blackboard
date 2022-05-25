'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'callins', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  it 'marks puzzle solved', ->
    share.Router.CallInPage()
    await waitForSubscriptions()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    await promiseCall 'deleteAnswer', target: pb._id
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

  it 'gets disappointed', ->
    share.Router.CallInPage()
    await waitForSubscriptions()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    await promiseCall 'deleteAnswer', target: pb._id
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    chai.assert.isNotOk pb.tags.answer
    await promiseCall 'newCallIn',
      callin_type: 'answer'
      target_type: 'puzzles'
      target: pb._id
      answer: 'teferi'
    await afterFlushPromise()
    incorrectButtons = $('.bb-callin-incorrect')
    chai.assert.equal incorrectButtons.length, 1
    incorrectButtons.click()
    await waitForMethods()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    msg = share.model.Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: /^sadly relays/}
    chai.assert.isOk msg

  it 'accepts explanation on accepted interaction request', ->
    share.Router.CallInPage()
    await waitForSubscriptions()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    await promiseCall 'deleteAnswer', target: pb._id
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    chai.assert.isNotOk pb.tags.answer
    await promiseCall 'newCallIn',
      callin_type: 'interaction request'
      target_type: 'puzzles'
      target: pb._id
      answer: 'teferi'
    await afterFlushPromise()
    $('input.response').val('phasing')
    correctButtons = $('.bb-callin-correct')
    chai.assert.equal correctButtons.length, 1
    correctButtons.click()
    await waitForMethods()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    msg = share.model.Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: 'reports that the interaction request "teferi" was ACCEPTED with response "phasing"! (Puzzle Box)'}
    chai.assert.isOk msg

  it 'accepts explanation on rejected interaction request', ->
    share.Router.CallInPage()
    await waitForSubscriptions()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    await promiseCall 'deleteAnswer', target: pb._id
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    chai.assert.isNotOk pb.tags.answer
    await promiseCall 'newCallIn',
      callin_type: 'interaction request'
      target_type: 'puzzles'
      target: pb._id
      answer: 'teferi'
    await afterFlushPromise()
    $('input.response').val('phasing')
    incorrectButtons = $('.bb-callin-incorrect')
    chai.assert.equal incorrectButtons.length, 1
    incorrectButtons.click()
    await waitForMethods()
    pb = share.model.Puzzles.findOne name: 'Puzzle Box'
    chai.assert.isNotOk pb.solved
    msg = share.model.Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: 'sadly relays that the interaction request "teferi" was REJECTED with response "phasing". (Puzzle Box)'}
    chai.assert.isOk msg

