'use strict'

import { FlowRouter } from 'meteor/ostrio:flow-router-extra'
import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import jitsiModule from './imports/jitsi.coffee'
import chai from 'chai'
import sinon from 'sinon'
import {reactiveLocalStorage} from './imports/storage.coffee'

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
    factory.never()

  expectFactory = ->
    fake = new FakeJitsiMeet
    mock = sinon.mock fake
    factory.verify()
    factory.resetHistory()
    factory.once().returns fake
    return mock
  
  afterEach ->
    await logout()
    sinon.verify()

  it 'uses static meeting name', ->
    mock = expectFactory()
    mock.expects('on').once().withArgs 'videoConferenceLeft', sinon.match.func
    mock.expects('executeCommand').once().withArgs 'subject', 'Ringhunters'
    mock.expects('executeCommands').once().withArgs
      displayName: 'Teresa Tybalt (testy)'
      avatarUrl: GRAVATAR_200

    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    chai.assert.isTrue factory.calledWithMatch 'codex_whiteNoiseFoyer', sinon.match.instanceOf(HTMLDivElement)

  it 'shares meeting between blackboard and edit', ->
    mock = expectFactory()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    FlowRouter.go 'Edit'
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1

  it 'shares meeting between blackboard and callins', ->
    mock = expectFactory()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    FlowRouter.go 'CallIns'
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1

  it 'joins new meeting when moving from blackboard to puzzle', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    mock2 = expectFactory()
    dispose2 = mock2.expects('dispose').never()
    mock2.expects('executeCommand').once().withArgs 'subject', 'In Memoriam'
    puzz = share.model.Puzzles.findOne name: 'In Memoriam'
    FlowRouter.go 'Puzzle', {id: puzz._id}
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose2.verify()
    dispose2.once()

  it 'stays in meeting when pinned', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    $('.bb-jitsi-pin').click()
    await afterFlushPromise()
    puzz = share.model.Puzzles.findOne name: 'In Memoriam'
    FlowRouter.go 'Puzzle', {id: puzz._id}
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    mock2 = expectFactory()
    $('.bb-jitsi-unpin').click()
    await afterFlushPromise()
    dispose1.verify()

  it 'doesn\'t rejoin when hangup callback is called', ->
    mock1 = expectFactory()
    on1 = mock1.expects('on').once().withArgs 'videoConferenceLeft', sinon.match.func
    dispose1 = mock1.expects('dispose').never()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    on1.verify()
    on1.firstCall.lastArg()
    await afterFlushPromise()
    dispose1.verify()
    puzz = share.model.Puzzles.findOne name: 'In Memoriam'
    FlowRouter.go 'Puzzle', {id: puzz._id}
    await afterFlushPromise()
    await waitForSubscriptions()
    mock2 = expectFactory()
    $('.bb-join-jitsi').click()
    await afterFlushPromise()

  it 'disposes when another tab joins meeting', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    try
      reactiveLocalStorage.setItem 'jitsiTabUUID', Random.id()
      await afterFlushPromise()
      dispose1.verify()
      puzz = share.model.Puzzles.findOne name: 'In Memoriam'
      FlowRouter.go 'Puzzle', {id: puzz._id}
      await afterFlushPromise()
      await waitForSubscriptions()
    finally
      reactiveLocalStorage.removeItem 'jitsiTabUUID'

  it 'join button clobbers other tab', ->
    reactiveLocalStorage.setItem 'jitsiTabUUID', Random.id()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    mock = expectFactory()
    $('.bb-join-jitsi').click()
    await afterFlushPromise()
    chai.assert.equal reactiveLocalStorage.getItem('jitsiTabUUID'), share.settings.CLIENT_UUID

  it 'doesn\'t rejoin when mute preference changes', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    FlowRouter.go 'Blackboard'
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    try
      reactiveLocalStorage.setItem 'startAudioMuted', 'false'
      await afterFlushPromise()
      dispose1.verify()
      dispose1.once()
    finally
      reactiveLocalStorage.setItem 'startAudioMuted', null
      

