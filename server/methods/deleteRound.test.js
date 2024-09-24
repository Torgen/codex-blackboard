// For side effects
import "/lib/model.js";
import { Messages, Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils";

describe("deleteRound", function () {
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  beforeEach(() => clearCollections(Messages, Rounds));

  describe("when it is empty", function () {
    let id = null;
    beforeEach(async function () {
      id = await Rounds.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        puzzles: [],
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(Meteor.callAsync("deleteRound", id), Match.Error);
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("deleteRound", "cjb", id);
      });

      it("returns true", () => chai.assert.isTrue(ret));

      it("deletes the round", async function () {
        chai.assert.isUndefined(
          await Rounds.findOneAsync(),
          "no rounds after deletion"
        );
      });
    });
  });

  describe("when round isn't empty", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Rounds.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        puzzles: ["foo1", "foo2"],
        tags: {},
      });
      ret = await callAs("deleteRound", "cjb", id);
    });

    it("returns false", function () {
      chai.assert.isFalse(ret);
    });

    it("leaves round", async function () {
      chai.assert.isNotNull(await Rounds.findOneAsync(id));
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: "oplog/0" }).fetchAsync(),
        0,
        "oplogs"
      );
    });
  });
});
