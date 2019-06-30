'use strict'

import './000setup.coffee'  # for side effects
import './memes.coffee' # for side effects
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '../imports/testutils.coffee'
import { MaximumMemeLength } from '/lib/imports/settings.coffee'
import delay from 'delay'
import { impersonating } from '../imports/impersonate.coffee'

model = share.model

describe 'memes hubot script', ->
  robot = null
  clock = null

  beforeEach ->
    resetDatabase()
    MaximumMemeLength.ensure()
    clock = sinon.useFakeTimers
      now: 6
      toFake: ["Date"]
    # can't use plain hubot because this script uses priv, which isn't part of
    # the standard message class or adapter.
    robot = new Robot 'testbot'
    share.hubot.memes robot
    robot.run()
    clock.tick 1

  afterEach ->
    robot.shutdown()
    clock.restore()

  it 'triggers multiple memes', ->
    model.Messages.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 7
      body: 'I don\'t always trigger all the meme templates, but when I do, I nailed it everywhere'
    interesting = waitForDocument model.Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/interesting/},
      room_name: 'general/0'
      timestamp: 7
    buzz = waitForDocument model.Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/buzz/},
      room_name: 'general/0'
      timestamp: 7
    xy = waitForDocument model.Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/xy/},
      room_name: 'general/0'
      timestamp: 7
    success = waitForDocument model.Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/success/},
      room_name: 'general/0'
      timestamp: 7
    Promise.all [interesting, buzz, xy, success]

  it 'maximum lemgth applies', ->
    impersonating 'cjb', -> MaximumMemeLength.set 50
    model.Messages.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 7
      body: 'I don\'t always trigger all the meme templates, but when I do, I nailed it everywhere'
    await delay 200
    chai.assert.isUndefined model.Messages.findOne nick: 'testbot', timestamp: 7