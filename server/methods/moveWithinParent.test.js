// For side effetcs
import "/lib/model.js";
import { Puzzles, Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

const testCase = (method, collection) =>
  describe(method, function () {
    let clock = null;

    beforeEach(function () {
      clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      });
    });

    afterEach(() => clock.restore());

    beforeEach(async function () {
      await clearCollections(collection);

      await collection.insertAsync({
        _id: "parent",
        puzzles: ["c1", "c2", "c3", "c4"],
        created_by: "cjb",
        created: 4,
        touched_by: "cjb",
        touched: 4,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync(method, "parent", "c1", { pos: 1 }),
        Match.Error
      );
    });

    it("fails when parent doesn't exist", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "nosuch", "child", { pos: 1 })
      );
    });

    it("fails when child doesn't exist", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "c5", "parent", { pos: 1 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4,
      });
    });

    it("moves down one", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c2", "parent", { pos: 1 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("moves up one", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c3", "parent", { pos: -1 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("moves down several", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c2", "parent", { pos: 2 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c3", "c4", "c2"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("moves up several", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c3", "parent", { pos: -2 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c3", "c1", "c2", "c4"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("fails to move past end", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "c4", "parent", { pos: 1 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4,
      });
    });

    it("fails to move past start", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "c1", "parent", { pos: -1 })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4,
      });
    });

    it("moves before", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c2", "parent", { before: "c4" })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("moves after", async function () {
      chai.assert.isTrue(
        await callAs(method, "torgen", "c3", "parent", { after: "c1" })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7,
      });
    });

    it("fails to move before absent", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "c2", "parent", { before: "c5" })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4,
      });
    });

    it("fails to move after absent", async function () {
      chai.assert.isFalse(
        await callAs(method, "torgen", "c3", "parent", { after: "c5" })
      );
      chai.assert.deepInclude(await collection.findOneAsync("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4,
      });
    });
  });

testCase("moveWithinMeta", Puzzles);
testCase("moveWithinRound", Rounds);
