'use strict'

import { Puzzles, Rounds } from '/lib/imports/collections.coffee'
import {waitForMethods, waitForSubscriptions, promiseCall, promiseCallOn, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'
import sinon from 'sinon'
import delay from 'delay'

GRAVATAR_192 = 'https://secure.gravatar.com/avatar/ec59d144f959e61bdf692ff0eb379d67.jpg?d=wavatar&s=192'

describe 'notifications dropdown', ->
  @timeout 10000
  before ->
    await login('testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase')
    share.Router.BlackboardPage()

  after ->
    logout()

  it 'enables and disables clicked streams', ->
    Session.set 'notifications', 'granted'
    await afterFlushPromise()
    try
      chai.assert.equal $('.bb-notification-controls').css('display'), 'none'
      $('.bb-notification-enabled + .dropdown-toggle').click()
      chai.assert.equal $('.bb-notification-controls').css('display'), 'block'
      chai.assert.isFalse $('input[data-notification-stream="new-puzzles"').prop('checked')
      chai.assert.notEqual localStorage.getItem('notification.stream.new-puzzles'), 'true'
      $('input[data-notification-stream="new-puzzles"').click()
      await afterFlushPromise()
      chai.assert.equal $('.bb-notification-controls').css('display'), 'block'
      chai.assert.isTrue $('input[data-notification-stream="new-puzzles"').prop('checked')
      chai.assert.equal localStorage.getItem('notification.stream.new-puzzles'), 'true'
      $('input[data-notification-stream="new-puzzles"').click()
      await afterFlushPromise()
      chai.assert.equal $('.bb-notification-controls').css('display'), 'block'
      chai.assert.isFalse $('input[data-notification-stream="new-puzzles"').prop('checked')
      chai.assert.notEqual localStorage.getItem('notification.stream.new-puzzles'), 'true'
      $('body').click()
      chai.assert.equal $('.bb-notification-controls').css('display'), 'none'
    finally
      Session.set 'notifications', 'default'

describe 'notifications', ->
  @timeout 10000
  other_conn = null
  before ->
    await login('testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase')
    other_conn = DDP.connect Meteor.absoluteUrl()
    await promiseCallOn other_conn, 'login',
      nickname: 'someoneelse'
      real_name: 'Someone Else'
      password: 'failphrase'
    share.Router.BlackboardPage()
  
  after ->
    logout()
  
  after ->
    other_conn.disconnect()

  testcase = (name, stream, title, settings, setup, cleanup) ->
    describe name, ->
      mock = null
      beforeEach ->
        mock = sinon.mock share.notification

      afterEach ->
        mock.verify()

      it 'does not notify when granted but not enabled', ->
        v = null
        try
          Session.set 'notifications', 'granted'
          share.notification.set stream, false
          mock.expects('notify').never()
          await afterFlushPromise()
          await waitForSubscriptions()
          v = await setup()
          await delay 1000
        finally
          await cleanup(v) if v?
          Session.set 'notifications', 'default'

      it 'does not notify when not granted ', ->
        v = null
        try
          Session.set 'notifications', 'denied'
          share.notification.set stream, true
          mock.expects('notify').never()
          await afterFlushPromise()
          await waitForSubscriptions()
          v = await setup()
          await delay 1000
        finally
          await cleanup(v) if v?
          Session.set 'notifications', 'default'
          share.notification.set stream, false

      it 'notifies when enabled', ->
        v = null
        try
          Session.set 'notifications', 'granted'
          share.notification.set stream, true
          notify = mock.expects('notify')
          p = new Promise (resolve) ->
            notify.once().callsFake(-> resolve())
          await afterFlushPromise()
          await waitForSubscriptions()
          v = await setup()
          await p
          sinon.assert.calledWith notify, title(v), settings(v)
        finally
          await cleanup(v) if v?
          Session.set 'notifications', 'default'
          share.notification.set stream, false

  testcase 'starred in main', 'announcements', (-> 'Announcement by someoneelse'), (-> sinon.match({body: 'what\'s up guys', icon: GRAVATAR_192})), ->
    msg = await promiseCallOn other_conn, 'newMessage', body: 'what\'s up guys'
    promiseCallOn other_conn, 'setStarred', msg._id, true
  , ->

  testcase 'new puzzle', 'new-puzzles', (-> 'someoneelse'), ((v) -> sinon.match({body: 'Added puzzle Test Notification', icon: GRAVATAR_192, data: url: "/puzzles/#{v}"})), ->
    round = Rounds.findOne name: 'Civilization'
    obj = await promiseCallOn other_conn, 'newPuzzle',
      name: 'Test Notification'
      round: round._id
    return obj._id
  , (id) -> promiseCallOn other_conn, 'deletePuzzle', id

  testcase 'new round', 'new-puzzles', (-> 'someoneelse'), ((v) -> sinon.match({body: 'Added round Test Notification', icon: GRAVATAR_192, data: url: "/rounds/#{v}"})), ->
    obj = await promiseCallOn other_conn, 'newRound',
      name: 'Test Notification'
    return obj._id
  , (id) -> promiseCallOn other_conn, 'deleteRound', id

  testcase 'new callin', 'callins', (-> 'someoneelse'), (-> sinon.match({body: 'New answer knob submitted for puzzle The Doors Of Cambridge', icon: GRAVATAR_192, data: url: "/logistics"})), ->
    doors = Puzzles.findOne name: 'The Doors Of Cambridge'
    obj = await promiseCallOn other_conn, 'newCallIn',
      target: doors._id
      answer: 'knob'
    return obj._id
  , (id) -> promiseCallOn other_conn, 'cancelCallIn', id: id

  testcase 'answer', 'answers', (-> 'someoneelse'), ((id)-> sinon.match({body: 'Found an answer (KNOB) to puzzle The Doors Of Cambridge', icon: GRAVATAR_192, data: url: "/puzzles/#{id}"})), ->
    doors = Puzzles.findOne name: 'The Doors Of Cambridge'
    await promiseCallOn other_conn, 'setAnswer',
      target: doors._id
      answer: 'knob'
    return doors._id
  , (id) -> promiseCallOn other_conn, 'deleteAnswer', target: id

  testcase 'mechanics', 'favorite-mechanics', (-> 'The Doors Of Cambridge'), ((id)-> sinon.match({body: 'Mechanic "Nikoli Variants" added to puzzle "The Doors Of Cambridge"', tag: "#{id}/nikoli_variants", data: url: "/puzzles/#{id}"})), ->
    await promiseCall 'favoriteMechanic', 'nikoli_variants'
    doors = Puzzles.findOne name: 'The Doors Of Cambridge'
    await promiseCallOn other_conn, 'addMechanic', doors._id, 'nikoli_variants'
    return doors._id
  , (id) ->
    await promiseCall 'unfavoriteMechanic', 'nikoli_variants'
    promiseCall 'removeMechanic', id, 'nikoli_variants'

  testcase 'private message', 'private-messages', (-> 'Private message from someoneelse in Puzzle "The Doors Of Cambridge"'), (({id, rand})-> sinon.match({body: "How you doin #{rand}", icon: GRAVATAR_192, data: url: "/puzzles/#{id}"})), ->
    doors = Puzzles.findOne name: 'The Doors Of Cambridge'
    rand = Random.id()
    await promiseCallOn other_conn, 'newMessage',
      room_name: "puzzles/#{doors._id}"
      to: 'testy'
      body: "How you doin #{rand}"
    return {id: doors._id, rand}
  , ->

  testcase 'mention', 'private-messages', (-> 'Mentioned by someoneelse in Puzzle "The Doors Of Cambridge"'), (({id, rand})-> sinon.match({body: "@testy How you doin #{rand}", icon: GRAVATAR_192, data: url: "/puzzles/#{id}"})), ->
    doors = Puzzles.findOne name: 'The Doors Of Cambridge'
    rand = Random.id()
    await promiseCallOn other_conn, 'newMessage',
      room_name: "puzzles/#{doors._id}"
      mention: ['testy']
      body: "@testy How you doin #{rand}"
    return {id: doors._id, rand}
  , ->


        