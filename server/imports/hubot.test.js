// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.js';
import { Messages, Presence } from '/lib/imports/collections.js';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import Robot from './hubot.js';
import delay from 'delay';
import { waitForDocument } from '/lib/imports//testutils.js';

describe('hubot', function() {

  let clock = null;
  let robot = null;

  beforeEach(function() {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setInterval", "clearInterval", "Date"]});
    return robot = new Robot('testbot', 'testbot@testbot.test');
  });

  afterEach(function() {
    robot.shutdown();
    return clock.restore();
  });

  beforeEach(() => resetDatabase());

  it('is present in main room', function() {
    robot.run();
    chai.assert.include(Presence.findOne({nick: 'testbot', room_name: 'general/0'}),
      {timestamp: 7});
    clock.tick(15000);
    chai.assert.include(Presence.findOne({nick: 'testbot', room_name: 'general/0'}),
      {timestamp: 7});
    clock.tick(15000);
    return chai.assert.include(Presence.findOne({nick: 'testbot', room_name: 'general/0'}),
      {timestamp: 30007});
  });

  it('announces presence', function() {
    robot.run();
    return chai.assert.include(Messages.findOne({dawn_of_time: {$ne: true}}), {
      nick: 'testbot',
      body: 'wakes up',
      action: true,
      room_name: 'general/0'
    }
    );
  });

  it('ignores old messages', function() {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    Messages.insert({
      timestamp: Date.now() - 2,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'sample'
    });
    robot.run();
    return chai.assert.isFalse(spy.called);
  });

  it('ignores old future messages', function() {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    Messages.insert({
      timestamp: Date.now() + 1000,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'sample'
    });
    robot.run();
    return chai.assert.isFalse(spy.called);
  });

  it('receives new messages', async function() {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    await new Promise(function(resolve, reject) {
      robot.hear(/.*/, resolve);
      robot.run();
      return Messages.insert({
        timestamp: Date.now() + 1,
        nick: 'torgen',
        room_name: 'general/0',
        body: 'sample'
      });
    });
    return chai.assert.isFalse(spy.called);
  });

  it('ignores itself', async function() {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    robot.run();
    Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'testbot',
      room_name: 'general/0',
      body: 'sample'
    });
    await delay(200);
    return chai.assert.isFalse(spy.called);
  });

  it('ignores HTML messages', async function() {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    robot.run();
    Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      room_name: 'general/0',
      body: '<b>sample</b>',
      bodyIsHtml: true
    });
    await delay(200);
    return chai.assert.isFalse(spy.called);
  });

  it('ignores actions', async function() {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    robot.run();
    Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'samples a puzzle',
      action: true
    });
    await delay(200);
    return chai.assert.isFalse(spy.called);
  });

  it('ignores with bot_ignore', async function() {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    robot.run();
    Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'sample',
      bot_ignore: true
    });
    await delay(200);
    return chai.assert.isFalse(spy.called);
  });

  it('receives enter messages', async function() {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    robot.leave(spy);
    await new Promise(function(resolve, reject) {
      robot.enter(resolve);
      robot.run();
      return Messages.insert({
        timestamp: Date.now() + 1,
        nick: 'torgen',
        room_name: 'general/0',
        presence: 'join',
        system: true
      });
    });
    return chai.assert.isFalse(spy.called);
  });

  it('receives leave messages', async function() {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    robot.enter(spy);
    await new Promise(function(resolve, reject) {
      robot.leave(resolve);
      robot.run();
      return Messages.insert({
        timestamp: Date.now() + 1,
        nick: 'torgen',
        room_name: 'general/0',
        presence: 'part',
        system: true
      });
    });
    return chai.assert.isFalse(spy.called);
  });

  it('replies to public messages publicly', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(2);
      return msg.reply('hello yourself');
    });
    robot.run();
    const id = Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'testbot hello'
    });
    await waitForDocument(Messages, {body: '@torgen: hello yourself', to: {$exists: false}}, {
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true,
      mention: ['torgen']
    });
    return chai.assert.include(Messages.findOne(id), {useless_cmd: true});
  });

  it('replies to private messages privately', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(1);
      return msg.reply('hello yourself');
    });
    robot.run();
    clock.tick(1);
    const id = Messages.insert({
      timestamp: Date.now(),
      nick: 'torgen',
      room_name: 'general/0',
      body: 'hello',
      to: 'testbot'
    });
    await waitForDocument(Messages, {body: 'hello yourself', to: 'torgen'}, { 
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true
    }
    );
    return chai.assert.notDeepInclude(Messages.findOne(id), {useless_cmd: true});
  });

  it('emotes to public messages publicly', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(2);
      return msg.emote('waves');
    });
    robot.run();
    const id = Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      room_name: 'general/0',
      body: 'testbot hello'
    });
    await waitForDocument(Messages, {body: 'waves', to: {$exists: false}}, {
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true,
      action: true
    }
    );
    return chai.assert.include(Messages.findOne(id), {useless_cmd: true});
  });

  it('emotes to private messages privately', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(2);
      return msg.emote('waves');
    });
    robot.run();
    const id = Messages.insert({
      timestamp: Date.now() + 1,
      nick: 'torgen',
      to: 'testbot',
      room_name: 'general/0',
      body: 'hello'
    });
    await waitForDocument(Messages, {body: '*** waves ***', to: 'torgen', action: {$ne: true}}, {
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true
    }
    );
    return chai.assert.notDeepInclude(Messages.findOne(id), {useless_cmd: true});
  });

  it('sends publicly', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(1);
      return msg.send({useful: true}, 'hello was said');
    });
    robot.run();
    clock.tick(1);
    const id = Messages.insert({
      timestamp: Date.now(),
      nick: 'torgen',
      room_name: 'general/0',
      body: 'testbot hello'
    });
    await waitForDocument(Messages, {body: 'hello was said', to: {$exists: false}}, {
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true,
      useful: true
    }
    );
    return chai.assert.notDeepInclude(Messages.findOne(id), {useless_cmd: true});
  });

  return it('privs privately', async function() {
    robot.respond(/hello/, function(msg) {
      clock.tick(1);
      return msg.priv('psst. hello');
    });
    robot.run();
    clock.tick(1);
    const id = Messages.insert({
      timestamp: Date.now(),
      nick: 'torgen',
      room_name: 'general/0',
      body: 'testbot hello'
    });
    await waitForDocument(Messages, {body: 'psst. hello', to: 'torgen'}, {
      timestamp: 9,
      nick: 'testbot',
      room_name: 'general/0',
      bot_ignore: true
    }
    );
    return chai.assert.include(Messages.findOne(id), {useless_cmd: true});
  });
});
  
  