'use strict'

import { Messages, Puzzles } from '/lib/imports/collections.coffee'
import Router from '/client/imports/router.coffee'
import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from '/client/imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'logistics', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  describe 'callins', ->
    it 'marks puzzle solved', ->
      await Router.LogisticsPage()
      await waitForSubscriptions()
      pb = Puzzles.findOne name: 'Puzzle Box'
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
      pb = Puzzles.findOne name: 'Puzzle Box'
      chai.assert.isOk pb.solved
      chai.assert.equal pb.tags.answer.value, 'teferi'

    it 'gets disappointed', ->
      await Router.LogisticsPage()
      await waitForSubscriptions()
      pb = Puzzles.findOne name: 'Puzzle Box'
      await promiseCall 'deleteAnswer', target: pb._id
      pb = Puzzles.findOne name: 'Puzzle Box'
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
      pb = Puzzles.findOne name: 'Puzzle Box'
      chai.assert.isNotOk pb.solved
      msg = Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: /^sadly relays/}
      chai.assert.isOk msg

    it 'accepts explanation on accepted interaction request', ->
      await Router.LogisticsPage()
      await waitForSubscriptions()
      pb = Puzzles.findOne name: 'Puzzle Box'
      await promiseCall 'deleteAnswer', target: pb._id
      pb = Puzzles.findOne name: 'Puzzle Box'
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
      pb = Puzzles.findOne name: 'Puzzle Box'
      chai.assert.isNotOk pb.solved
      msg = Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: 'reports that the interaction request "teferi" was ACCEPTED with response "phasing"! (Puzzle Box)'}
      chai.assert.isOk msg

    it 'accepts explanation on rejected interaction request', ->
      await Router.LogisticsPage()
      await waitForSubscriptions()
      pb = Puzzles.findOne name: 'Puzzle Box'
      await promiseCall 'deleteAnswer', target: pb._id
      pb = Puzzles.findOne name: 'Puzzle Box'
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
      pb = Puzzles.findOne name: 'Puzzle Box'
      chai.assert.isNotOk pb.solved
      msg = Messages.findOne {room_name: "general/0", nick: 'testy', action: true, body: 'sadly relays that the interaction request "teferi" was REJECTED with response "phasing". (Puzzle Box)'}
      chai.assert.isOk msg

