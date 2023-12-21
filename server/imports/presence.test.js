import { Messages, Presence, Puzzles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import delay from "delay";
import { waitForDocument } from "/lib/imports/testutils.js";
import watchPresence from "./presence.js";

describe("presence", function () {
  let clock = null;
  let presence = null;

  beforeEach(function () {
    resetDatabase();
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
      Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      await delay(200);
      chai.assert.isUndefined(
        Messages.findOne({ presence: "join", nick: "torgen" })
      );
    });

    it("ignores oplog room", async function () {
      presence = watchPresence();
      Presence.insert({
        nick: "torgen",
        room_name: "oplog/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      await delay(200);
      chai.assert.isUndefined(
        Messages.findOne({ presence: "join", nick: "torgen" })
      );
    });

    it("ignores non-chat scope", async function () {
      presence = watchPresence();
      Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 9,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      await delay(200);
      chai.assert.isUndefined(
        Messages.findOne({ presence: "join", nick: "torgen" })
      );
    });

    it("uses nickname when no users entry", function () {
      presence = watchPresence();
      Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 9,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      waitForDocument(
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

    it("uses real name from users entry", function () {
      presence = watchPresence();
      Meteor.users.insert({
        _id: "torgen",
        nickname: "Torgen",
        real_name: "Dan Rosart",
      });
      Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 8,
        joined_timestamp: 8,
        clients: [{ connection_id: "test", timestamp: 9 }],
      });
      waitForDocument(
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
      const id = Presence.insert({
        nick: "torgen",
        room_name: "oplog/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      Presence.remove(id);
      await delay(200);
      chai.assert.isUndefined(
        Messages.findOne({ presence: "part", nick: "torgen" })
      );
    });

    it("ignores non-chat scope", async function () {
      const id = Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      Presence.remove(id);
      await delay(200);
      chai.assert.isUndefined(
        Messages.findOne({ presence: "part", nick: "torgen" })
      );
    });

    it("removes stale presence", async function () {
      // This would happen in the server restarted.
      const id = Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "jitsi",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      clock.tick(240000);
      await delay(200);
      chai.assert.isUndefined(Presence.findOne(id));
    });

    it("removes presence without connections", async function () {
      // This would happen if you closed the tab or changed rooms.
      const id = Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      Presence.update(id, { $set: { clients: [] } });
      await delay(200);
      chai.assert.isUndefined(Presence.findOne(id));
    });

    it("uses nickname when no users entry", function () {
      const id = Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      presence = watchPresence();
      Presence.remove(id);
      waitForDocument(
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

    it("uses real name from users entry", function () {
      const id = Presence.insert({
        nick: "torgen",
        room_name: "general/0",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      Meteor.users.insert({
        _id: "torgen",
        nickname: "Torgen",
        real_name: "Dan Rosart",
      });
      presence = watchPresence();
      Presence.remove(id);
      waitForDocument(
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
    it("updates unsolved puzzle", function () {
      Presence.insert({
        nick: "torgen",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      Puzzles.insert({
        _id: "foo",
        solverTime: 45,
      });
      presence = watchPresence();
      Presence.update(
        { nick: "torgen", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      waitForDocument(Puzzles, { _id: "foo", solverTime: 54 }, {});
    });

    it("ignores bot user", function () {
      Presence.insert({
        nick: "botto",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
        bot: true,
      });
      Puzzles.insert({
        _id: "foo",
        solverTime: 45,
      });
      presence = watchPresence();
      Presence.update(
        { nick: "botto", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      waitForDocument(Puzzles, { _id: "foo", solverTime: 45 }, {});
    });

    it("ignores solved puzzle", async function () {
      Presence.insert({
        nick: "torgen",
        room_name: "puzzles/foo",
        scope: "chat",
        timestamp: 6,
        joined_timestamp: 6,
        clients: [{ connection_id: "test", timestamp: 6 }],
      });
      Puzzles.insert({
        _id: "foo",
        solverTime: 45,
        solved: 80,
      });
      presence = watchPresence();
      Presence.update(
        { nick: "torgen", room_name: "puzzles/foo" },
        { $set: { timestamp: 15 } }
      );
      await delay(200);
      chai.assert.deepInclude(Puzzles.findOne("foo"), {
        solverTime: 45,
      });
    });
  });
});
