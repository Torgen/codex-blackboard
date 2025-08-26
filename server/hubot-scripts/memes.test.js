import memes from "./memes.js"; // for side effects
import { Messages } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import Robot from "../imports/hubot.js";
import { clearCollections, waitForDocument } from "/lib/imports/testutils.js";
import { MaximumMemeLength } from "/lib/imports/settings.js";
import delay from "delay";
import { impersonating } from "../imports/impersonate.js";

describe("memes hubot script", function () {
  let robot = null;
  let clock = null;

  beforeEach(async function () {
    clearCollections(Messages);
    clock = sinon.useFakeTimers({
      now: 6,
      toFake: ["Date"],
    });
    // can't use plain hubot because this script uses priv, which isn't part of
    // the standard message class or adapter.
    robot = new Robot("testbot", "testbot@testbot.test");
    memes(robot);
    await robot.run();
    clock.tick(1);
  });

  afterEach(function () {
    robot.shutdown();
    clock.restore();
  });

  it("triggers multiple memes", async function () {
    await Messages.insertAsync({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 7,
      body: "I don't always trigger all the meme templates, but when I do, I nailed it everywhere",
    });
    const interesting = waitForDocument(
      Messages,
      { nick: "testbot", body: /https:\/\/api.memegen.link\/interesting/ },
      {
        room_name: "general/0",
        timestamp: 7,
      }
    );
    const buzz = waitForDocument(
      Messages,
      { nick: "testbot", body: /https:\/\/api.memegen.link\/buzz/ },
      {
        room_name: "general/0",
        timestamp: 7,
      }
    );
    const xy = waitForDocument(
      Messages,
      { nick: "testbot", body: /https:\/\/api.memegen.link\/xy/ },
      {
        room_name: "general/0",
        timestamp: 7,
      }
    );
    const success = waitForDocument(
      Messages,
      { nick: "testbot", body: /https:\/\/api.memegen.link\/success/ },
      {
        room_name: "general/0",
        timestamp: 7,
      }
    );
    await Promise.all([interesting, buzz, xy, success]);
  });

  it("maximum lemgth applies", async function () {
    await impersonating("cjb", () => MaximumMemeLength.set(50));
    await Messages.insertAsync({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 7,
      body: "I don't always trigger all the meme templates, but when I do, I nailed it everywhere",
    });
    await delay(200);
    chai.assert.isUndefined(
      await Messages.findOneAsync({ nick: "testbot", timestamp: 7 })
    );
  });
});
