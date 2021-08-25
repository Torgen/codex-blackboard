'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import jitsiModule from './imports/jitsi.coffee'
import chai from 'chai'
import sinon from 'sinon'

GRAVATAR_200 = 'https://secure.gravatar.com/avatar/a24f643d34150c3b4053989db38251c9.jpg?d=wavatar&s=200'

class FakeJitsiMeet
  dispose: ->
  on: (event, handler) ->
  executeCommand: (cmd, param) ->
  executeCommands: (cmds) ->

defaultLogin = -> login 'testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase'

describe 'jitsi', ->
  @timeout 10000

  factory = null
  beforeEach ->
    factory = sinon.mock(jitsiModule).expects('createJitsiMeet')

  expectFactory = ->
    fake = new FakeJitsiMeet
    mock = sinon.mock fake
    factory.returns fake
    return mock
  
  afterEach ->
    await logout()
    await afterFlushPromise()
    sinon.verify()

  it 'uses static meeting name', ->
    mock = expectFactory()
    mock.expects('on').once().withArgs 'videoConferenceLeft', sinon.match.func
    mock.expects('executeCommand').once().withArgs 'subject', 'Ringhunters'
    mock.expects('executeCommands').once().withArgs
      displayName: 'Teresa Tybalt (testy)'
      avatarUrl: GRAVATAR_200

    share.Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    chai.assert.isTrue factory.calledWithMatch 'codex_whiteNoiseFoyer', sinon.match.instanceOf(HTMLDivElement)

  it 'shares meeting between blackboard and edit', ->
    mock = expectFactory()
    share.Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    share.Router.EditPage()
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1

  it 'shares meeting between blackboard and callins', ->
    mock = expectFactory()
    share.Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    share.Router.CallInPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1
