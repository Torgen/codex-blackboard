// For side effects
import "/lib/model.js";
import { Messages } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils";

describe("setStarred", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages));

  it("fails without login", async function () {
    const id = await Messages.insertAsync({
      nick: "torgen",
      body: "nobody star this",
      timestamp: 5,
      room_name: "general/0",
    });
    await assertRejects(Meteor.callAsync("setStarred", id, true), Match.Error);
  });

  describe("in main room", function () {
    it("announces on star", async function () {
      const id = await Messages.insertAsync({
        nick: "torgen",
        body: "nobody star this",
        timestamp: 5,
        room_name: "general/0",
      });
      await callAs("setStarred", "cjb", id, true);
      chai.assert.include(await Messages.findOneAsync(id), {
        starred: true,
        announced_at: 7,
        announced_by: "cjb",
      });
    });

    it("leaves announced on unstar", async function () {
      const id = await Messages.insertAsync({
        nick: "torgen",
        body: "nobody star this",
        timestamp: 5,
        room_name: "general/0",
        announced_at: 6,
        announced_by: "cjb",
      });
      await callAs("setStarred", "cjb", id, false);
      chai.assert.include(await Messages.findOneAsync(id), {
        starred: null,
        announced_at: 6,
        announced_by: "cjb",
      });
    });

    it("does not reannounce on re-star", async function () {
      const id = await Messages.insertAsync({
        nick: "torgen",
        body: "nobody star this",
        timestamp: 5,
        room_name: "general/0",
        starred: false,
        announced_at: 6,
        announced_by: "kwal",
      });
      await callAs("setStarred", "cjb", id, true);
      chai.assert.include(await Messages.findOneAsync(id), {
        starred: true,
        announced_at: 6,
        announced_by: "kwal",
      });
    });
  });

  describe("in other room", function () {
    it("stars but does not announce", async function () {
      const id = await Messages.insertAsync({
        nick: "torgen",
        body: "nobody star this",
        timestamp: 5,
        room_name: "puzzles/0",
      });
      await callAs("setStarred", "cjb", id, true);
      const msg = await Messages.findOneAsync(id);
      chai.assert.include(msg, { starred: true });
      chai.assert.notProperty(msg, "announced_at");
      chai.assert.notProperty(msg, "announced_by");
    });

    it("unstars", async function () {
      const id = await Messages.insertAsync({
        nick: "torgen",
        body: "nobody star this",
        timestamp: 5,
        room_name: "puzzles/0",
      });
      await callAs("setStarred", "cjb", id, false);
      chai.assert.include(await Messages.findOneAsync(id), { starred: null });
    });
  });

  it("fails on unstarrable", async function () {
    const id = await Messages.insertAsync({
      nick: "torgen",
      body: "won't let you star this",
      action: true,
      timestamp: 5,
      room_name: "general/0",
    });
    await callAs("setStarred", "cjb", id, true);
    chai.assert.notInclude(await Messages.findOneAsync(id), { starred: null });
  });
});
