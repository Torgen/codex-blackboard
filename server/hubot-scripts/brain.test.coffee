'use strict'

import './000setup.coffee'  # for side effects
import script, { brain } from './brain.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '../imports/testutils.coffee'
import delay from 'delay'

describe 'brain hubot script', ->
  robot = null
  clock = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 7
      toFake: ["Date", 'setInterval', 'clearInterval']
    # can't use plain hubot because this script uses priv, which isn't part of
    # the standard message class or adapter.
    robot = new Robot 'testbot', 'testbot@testbot.test'

  afterEach ->
    robot.shutdown()
    clock.restore()

  it 'loads data', ->
    brain.insert
      _id: 'ambushes'
      value:
        torgen: ['hi']
        cjb: ['yo', 'wazzup?']
    brain.insert
      _id: 'drinks'
      value: 3
    script robot
    robot.run()
    chai.assert.deepInclude robot.brain.data,
      ambushes:
        torgen: ['hi']
        cjb: ['yo', 'wazzup?']
      drinks: 3

  it 'saves data', ->
    script robot
    robot.run()
    robot.brain.data.ambushes =
      torgen: ['hi']
      cjb: ['yo', 'wazzup?']
    robot.brain.data.drinks = 3
    clock.tick 5000
    ambushes = waitForDocument brain, {_id: 'ambushes'},
      value:
        torgen: ['hi']
        cjb: ['yo', 'wazzup?']
    drinks = waitForDocument brain, {_id: 'drinks'},
      value: 3
    Promise.all [ambushes, drinks]

  it 'syncs users', ->
    Meteor.users.insert
      _id: 'torgen'
    script robot
    robot.run()
    chai.assert.deepInclude robot.brain.data.users.torgen,
      name: 'torgen'
    Meteor.users.update 'torgen', $set: nickname: 'Torgen'
    await delay 200
    chai.assert.deepInclude robot.brain.data.users.torgen,
      name: 'Torgen'
    Meteor.users.update 'torgen', $set: real_name: 'Dan Rosart'
    await delay 200
    chai.assert.deepInclude robot.brain.data.users.torgen,
      name: 'Dan Rosart'
