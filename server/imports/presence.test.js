import { Presence, Puzzles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import delay from "delay";
import { clearCollections, waitForDocument } from "/lib/imports/testutils.js";
import watchPresence from "./presence.js";

describe("presence", function () {
  let clock = null;
  let presence = null;

  beforeEach(async function () {
    await clearCollections(Presence, Puzzles, Meteor.users);
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setInterval", "clearInterval", "Date"],
    });
  });

  afterEach(function () {
    presence.stop();
    clock.restore();
  });

  describe("update", function () {
    it("updates unsolved puzzle", async function () {
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      await Puzzles.insertAsync({
        _id: "foo",
        solverTime: 45,
      });
      presence = await watchPresence();
      await Presence.updateAsync(
        { nick: "torgen", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      await waitForDocument(Puzzles, { _id: "foo", solverTime: 54 }, {});
    });

    it("ignores bot user", async function () {
      await Presence.insertAsync({
        nick: "botto",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
        bot: true,
      });
      await Puzzles.insertAsync({
        _id: "foo",
        solverTime: 45,
      });
      presence = await watchPresence();
      await Presence.updateAsync(
        { nick: "botto", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      await waitForDocument(Puzzles, { _id: "foo", solverTime: 45 }, {});
    });

    it("ignores solved puzzle", async function () {
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      await Puzzles.insertAsync({
        _id: "foo",
        solverTime: 45,
        solved: 80,
      });
      presence = await watchPresence();
      await Presence.updateAsync(
        { nick: "torgen", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      await delay(200);
      chai.assert.deepInclude(await Puzzles.findOneAsync("foo"), {
        solverTime: 45,
      });
    });
  });
});
