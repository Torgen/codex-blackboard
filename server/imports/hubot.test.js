// For side effects
import "/lib/model.js";
import { Messages, Presence } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import Robot from "./hubot.js";
import delay from "delay";
import { clearCollections, waitForDocument } from "/lib/imports/testutils.js";

describe("hubot", function () {
  let clock = null;
  let robot = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setInterval", "clearInterval", "Date"],
    });
    robot = new Robot("testbot", "testbot@testbot.test");
  });

  afterEach(function () {
    robot.shutdown();
    clock.restore();
  });

  beforeEach(() => clearCollections(Messages, Presence));

  it("is present in main room", async function () {
    await robot.run();
    await waitForDocument(
      Presence,
      { nick: "testbot", room_name: "general/0", timestamp: 7 },
      {}
    );
    clock.tick(15000);
    await waitForDocument(
      Presence,
      { nick: "testbot", room_name: "general/0", timestamp: 7 },
      {}
    );
    clock.tick(15000);
    await waitForDocument(
      Presence,
      { nick: "testbot", room_name: "general/0", timestamp: 30007 },
      {}
    );
  });

  it("announces presence", async function () {
    await robot.run();
    chai.assert.include(
      await Messages.findOneAsync({ dawn_of_time: { $ne: true } }),
      {
        nick: "testbot",
        body: "wakes up",
        action: true,
        room_name: "general/0",
      }
    );
  });

  it("ignores old messages", async function () {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    await Messages.insertAsync({
      timestamp: Date.now() - 2,
      nick: "torgen",
      room_name: "general/0",
      body: "sample",
    });
    await robot.run();
    chai.assert.isFalse(spy.called);
  });

  it("ignores old future messages", async function () {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    await Messages.insertAsync({
      timestamp: Date.now() + 1000,
      nick: "torgen",
      room_name: "general/0",
      body: "sample",
    });
    await robot.run();
    chai.assert.isFalse(spy.called);
  });

  it("receives new messages", async function () {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    let resolve;
    // TODO: use Promise.withResolvers when it's available
    const p = new Promise(function (r) {
      resolve = r;
    });
    robot.hear(/.*/, resolve);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "sample",
    });
    await p;
    chai.assert.isFalse(spy.called);
  });

  it("ignores itself", async function () {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "testbot",
      room_name: "general/0",
      body: "sample",
    });
    await delay(200);
    chai.assert.isFalse(spy.called);
  });

  it("ignores HTML messages", async function () {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "<b>sample</b>",
      bodyIsHtml: true,
    });
    await delay(200);
    chai.assert.isFalse(spy.called);
  });

  it("ignores actions", async function () {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "samples a puzzle",
      action: true,
    });
    await delay(200);
    chai.assert.isFalse(spy.called);
  });

  it("ignores with bot_ignore", async function () {
    const spy = sinon.spy();
    robot.enter(spy);
    robot.leave(spy);
    robot.hear(/.*/, spy);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "sample",
      bot_ignore: true,
    });
    await delay(200);
    chai.assert.isFalse(spy.called);
  });

  it("receives enter messages", async function () {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    robot.leave(spy);
    let resolve;
    // TODO: use Promise.withResolvers when it's available
    const p = new Promise(function (r) {
      resolve = r;
    });
    robot.enter(resolve);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      presence: "join",
      system: true,
    });
    await p;
    chai.assert.isFalse(spy.called);
  });

  it("receives leave messages", async function () {
    const spy = sinon.spy();
    robot.hear(/.*/, spy);
    robot.enter(spy);
    let resolve;
    // TODO: use Promise.withResolvers when it's available
    const p = new Promise(function (r) {
      resolve = r;
    });
    robot.leave(resolve);
    await robot.run();
    await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      presence: "part",
      system: true,
    });
    await p;
    chai.assert.isFalse(spy.called);
  });

  it("replies to public messages publicly", async function () {
    robot.respond(/hello/, function (msg) {
      clock.tick(2);
      msg.reply("hello yourself");
    });
    await robot.run();
    const id = await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "testbot hello",
    });
    await waitForDocument(
      Messages,
      { body: "@torgen: hello yourself", to: { $exists: false } },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
        mention: ["torgen"],
      }
    );
    chai.assert.include(await Messages.findOneAsync(id), { useless_cmd: true });
  });

  it("replies to private messages privately", async function () {
    robot.respond(/hello/, function (msg) {
      clock.tick(1);
      msg.reply("hello yourself");
    });
    await robot.run();
    clock.tick(1);
    const id = await Messages.insertAsync({
      timestamp: Date.now(),
      nick: "torgen",
      room_name: "general/0",
      body: "hello",
      to: "testbot",
    });
    await waitForDocument(
      Messages,
      { body: "hello yourself", to: "torgen" },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
      }
    );
    chai.assert.notDeepInclude(await Messages.findOneAsync(id), {
      useless_cmd: true,
    });
  });

  it("emotes to public messages publicly", async function () {
    robot.respond(/hello/, function (msg) {
      clock.tick(2);
      msg.emote("waves");
    });
    await robot.run();
    const id = await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      room_name: "general/0",
      body: "testbot hello",
    });
    await waitForDocument(
      Messages,
      { body: "waves", to: { $exists: false } },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
        action: true,
      }
    );
    chai.assert.include(await Messages.findOneAsync(id), { useless_cmd: true });
  });

  it("emotes to private messages privately", async function () {
    robot.respond(/hello/, function (msg) {
      clock.tick(2);
      msg.emote("waves");
    });
    await robot.run();
    const id = await Messages.insertAsync({
      timestamp: Date.now() + 1,
      nick: "torgen",
      to: "testbot",
      room_name: "general/0",
      body: "hello",
    });
    await waitForDocument(
      Messages,
      { body: "*** waves ***", to: "torgen", action: { $ne: true } },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
      }
    );
    chai.assert.notDeepInclude(await Messages.findOneAsync(id), {
      useless_cmd: true,
    });
  });

  it("sends publicly", async function () {
    robot.respond(/hello/, async function (msg) {
      clock.tick(1);
      await msg.send({ useful: true }, "hello was said");
    });
    await robot.run();
    clock.tick(1);
    const id = await Messages.insertAsync({
      timestamp: Date.now(),
      nick: "torgen",
      room_name: "general/0",
      body: "testbot hello",
    });
    await waitForDocument(
      Messages,
      { body: "hello was said", to: { $exists: false } },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
        useful: true,
      }
    );
    chai.assert.notDeepInclude(await Messages.findOneAsync(id), {
      useless_cmd: true,
    });
  });

  it("privs privately", async function () {
    robot.respond(/hello/, async function (msg) {
      clock.tick(1);
      await msg.priv("psst. hello");
    });
    await robot.run();
    clock.tick(1);
    const id = await Messages.insertAsync({
      timestamp: Date.now(),
      nick: "torgen",
      room_name: "general/0",
      body: "testbot hello",
    });
    await waitForDocument(
      Messages,
      { body: "psst. hello", to: "torgen" },
      {
        timestamp: 9,
        nick: "testbot",
        room_name: "general/0",
        bot_ignore: true,
      }
    );
    chai.assert.include(await Messages.findOneAsync(id), { useless_cmd: true });
  });
});
