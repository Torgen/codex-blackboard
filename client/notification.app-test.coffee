'use strict'

import {waitForMethods, waitForSubscriptions, promiseCall, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'
import sinon from 'sinon'

GRAVATAR_192 = "https://secure.gravatar.com/avatar/a24f643d34150c3b4053989db38251c9.jpg?d=wavatar&s=192"

describe 'notifications', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase')
  
  after ->
    logout()

  testcase = (name, stream, title, settings, setup) ->
    describe name, ->
      mock = null
      beforeEach ->
        mock = sinon.mock share.notification

      afterEach ->
        mock.verify()

      it 'notifies when enabled', ->
        try
          Session.set 'notifications', 'granted'
          share.notification.set stream, true
          mock.expects('notify').once().withArgs(title, settings)
          await afterFlushPromise()
          await waitForSubscriptions()
          await setup()
        finally
          Session.set 'notifications', 'default'
          share.notification.set stream, false

      it 'does not notify when granted but not enabled', ->
        try
          Session.set 'notifications', 'granted'
          share.notification.set stream, false
          mock.expects('notify').never()
          await afterFlushPromise()
          await waitForSubscriptions()
          await setup()
        finally
          Session.set 'notifications', 'default'

      it 'does not notify when not granted ', ->
        try
          Session.set 'notifications', 'denied'
          share.notification.set stream, true
          mock.expects('notify').never()
          await afterFlushPromise()
          await waitForSubscriptions()
          await setup()
        finally
          Session.set 'notifications', 'default'
          share.notification.set stream, false

  testcase 'announcement', 'announcements', 'testy', sinon.match({body: 'what\'s up guys', icon: GRAVATAR_192}), ->
    promiseCall 'announce', 'what\'s up guys'

        