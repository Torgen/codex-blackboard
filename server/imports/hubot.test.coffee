'use strict'

# Will access contents via share
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from './hubot.coffee'
import delay from 'delay'

model = share.model

describe 'hubot', ->

  clock = null
  robot = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ["setInterval", "clearInterval", "Date"]
    robot = new Robot 'testbot'

  afterEach ->
    robot.shutdown()
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'is present in main room', ->
    robot.run()
    chai.assert.include model.Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      present: true
      timestamp: 7
    clock.tick 15000
    chai.assert.include model.Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      present: true
      timestamp: 7
    clock.tick 15000
    chai.assert.include model.Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      present: true
      timestamp: 30007

  it 'announces presence', ->
    robot.run()
    chai.assert.include model.Messages.findOne(dawn_of_time: $ne: true),
      nick: 'testbot'
      body: 'wakes up'
      action: true
      room_name: 'general/0'

  it 'ignores old messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    model.Messages.insert
      timestamp: Date.now() - 2
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
    robot.run()
    chai.assert.isFalse spy.called

  it 'ignores old future messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    model.Messages.insert
      timestamp: Date.now() + 1000
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
    robot.run()
    chai.assert.isFalse spy.called

  it 'receives new messages', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    await new Promise (resolve, reject) ->
      robot.hear /.*/, resolve
      robot.run()
      model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'sample'
    chai.assert.isFalse spy.called

  it 'ignores itself', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    model.Messages.insert
      timestamp: Date.now() + 1
      nick: 'testbot'
      room_name: 'general/0'
      body: 'sample'
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores HTML messages', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    model.Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: '<b>sample</b>'
      bodyIsHtml: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores actions', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    model.Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'samples a puzzle'
      action: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores with bot_ignore', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    model.Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
      bot_ignore: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'receives enter messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    robot.leave spy
    await new Promise (resolve, reject) ->
      robot.enter resolve
      robot.run()
      model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        presence: 'join'
        system: true
    chai.assert.isFalse spy.called

  it 'receives leave messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    robot.enter spy
    await new Promise (resolve, reject) ->
      robot.leave resolve
      robot.run()
      model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        presence: 'part'
        system: true
    chai.assert.isFalse spy.called

  it 'replies to public messages publicly', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.reply 'hello yourself'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'testbot hello'
      handle = model.Messages.find(body: 'torgen: hello yourself', to: $exists: false).observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
          resolve()
    handle.stop()
    chai.assert.include model.Messages.findOne(id), useless_cmd: true

  it 'replies to private messages privately', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.reply 'hello yourself'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'hello'
        to: 'testbot'
      handle = model.Messages.find(body: 'hello yourself', to: 'torgen').observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
          resolve()
    handle.stop()
    chai.assert.notDeepInclude model.Messages.findOne(id), useless_cmd: true

  it 'emotes to public messages publicly', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.emote 'waves'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'testbot hello'
      handle = model.Messages.find(body: 'waves', to: $exists: false).observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
            action: true
          resolve()
    handle.stop()
    chai.assert.include model.Messages.findOne(id), useless_cmd: true

  it 'emotes to private messages privately', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.emote 'waves'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        to: 'testbot'
        room_name: 'general/0'
        body: 'hello'
      handle = model.Messages.find(body: '*** waves ***', to: 'torgen', action: $ne: true).observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
          resolve()
    handle.stop()
    chai.assert.notDeepInclude model.Messages.findOne(id), useless_cmd: true

  it 'sends publicly', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.send useful: true, 'hello was said'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'testbot hello'
      handle = model.Messages.find(body: 'hello was said', to: $exists: false).observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
            useful: true
          resolve()
    handle.stop()
    chai.assert.notDeepInclude model.Messages.findOne(id), useless_cmd: true

  it 'privs privately', ->
    handle = null
    id = null
    await new Promise (resolve, reject) ->
      robot.respond /hello/, (msg) ->
        clock.tick 2
        msg.priv 'psst. hello'
      robot.run()
      id = model.Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'testbot hello'
      handle = model.Messages.find(body: 'psst. hello', to: 'torgen').observe
        added: (msg) ->
          chai.assert.include msg,
            timestamp: 9
            nick: 'testbot'
            room_name: 'general/0'
            bot_ignore: true
          resolve()
    handle.stop()
    chai.assert.include model.Messages.findOne(id), useless_cmd: true
  
  