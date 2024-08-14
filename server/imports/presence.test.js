import { Messages, Presence, Puzzles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import delay from "delay";
import { clearCollections, waitForDocument } from "/lib/imports/testutils.js";
import watchPresence from "./presence.js";

describe("presence", function () {
  let clock = null;
  let presence = null;

  beforeEach(async function () {
    await clearCollections(Messages, Presence, Puzzles, Meteor.users);
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setInterval", "clearInterval", "Date"],
    });
  });

  afterEach(function () {
    presence.stop();
    clock.restore();
  });

  describe("join", function () {
    it("ignores existing presence", async function () {
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      await delay(200);
      chai.assert.isUndefined(
        await Messages.findOneAsync({ presence: "join", nick: "torgen" })
      );
    });

    it("ignores oplog room", async function () {
      presence = await watchPresence();
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "oplog/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      await delay(200);
      chai.assert.isUndefined(
        await Messages.findOneAsync({ presence: "join", nick: "torgen" })
      );
    });

    it("ignores non-chat scope", async function () {
      presence = await watchPresence();
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 9,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      await delay(200);
      chai.assert.isUndefined(
        await Messages.findOneAsync({ presence: "join", nick: "torgen" })
      );
    });

    it("uses nickname when no users entry", async function () {
      presence = await watchPresence();
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 9,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      await waitForDocument(
        Messages,
        { nick: "torgen", presence: "join" },
        {
          system: true,
          room_name: "general/0",
          body: "torgen joined the room.",
          timestamp: 8,
        }
      );
    });

    it("uses real name from users entry", async function () {
      presence = await watchPresence();
      await Meteor.users.insertAsync({
        _id: "torgen",
        nickname: "Torgen",
        real_name: "Dan Rosart",
      });
      await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 8,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      await waitForDocument(
        Messages,
        { nick: "torgen", presence: "join" },
        {
          system: true,
          room_name: "general/0",
          body: "Dan Rosart joined the room.",
          timestamp: 8,
        }
      );
    });
  });

  describe("part", function () {
    it("ignores oplog room", async function () {
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "oplog/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      await Presence.removeAsync(id);
      await delay(200);
      chai.assert.isUndefined(
        await Messages.findOneAsync({ presence: "part", nick: "torgen" })
      );
    });

    it("ignores non-chat scope", async function () {
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      await Presence.removeAsync(id);
      await delay(200);
      chai.assert.isUndefined(
        await Messages.findOneAsync({ presence: "part", nick: "torgen" })
      );
    });

    it("removes stale presence", async function () {
      // This would happen in the server restarted.
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      clock.tick(240000);
      await delay(200);
      chai.assert.isUndefined(await Presence.findOneAsync(id));
    });

    it("removes presence without connections", async function () {
      // This would happen if you closed the tab or changed rooms.
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      await Presence.updateAsync(id, { $set: { clients: [] } });
      await delay(200);
      chai.assert.isUndefined(await Presence.findOneAsync(id));
    });

    it("uses nickname when no users entry", async function () {
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = await watchPresence();
      await Presence.removeAsync(id);
      await waitForDocument(
        Messages,
        { nick: "torgen", presence: "part" },
        {
          system: true,
          room_name: "general/0",
          body: "torgen left the room.",
          timestamp: 7,
        }
      );
    });

    it("uses real name from users entry", async function () {
      const id = await Presence.insertAsync({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      await Meteor.users.insertAsync({
        _id: "torgen",
        nickname: "Torgen",
        real_name: "Dan Rosart",
      });
      presence = await watchPresence();
      await Presence.removeAsync(id);
      await waitForDocument(
        Messages,
        { nick: "torgen", presence: "part" },
        {
          system: true,
          room_name: "general/0",
          body: "Dan Rosart left the room.",
          timestamp: 7,
        }
      );
    });
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
