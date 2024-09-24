// For side effects
import "/lib/model.js";
import { Messages, Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("renameRound", function () {
  let clock = null;
  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  beforeEach(() => clearCollections(Messages, Rounds));

  describe("when new name is unique", function () {
    let id = null;
    beforeEach(async function () {
      id = await Rounds.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        puzzles: ["yoy"],
        link: "https://puzzlehunt.mit.edu/foo",
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("renameRound", {
          id,
          name: "Bar",
        }),
        Match.Error
      );
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("renameRound", "cjb", {
          id,
          name: "Bar",
        });
      });

      it("returns true", () => chai.assert.isTrue(ret));

      it("renames round", async function () {
        const round = await Rounds.findOneAsync(id);
        chai.assert.include(round, {
          name: "Bar",
          canon: "bar",
          touched: 7,
          touched_by: "cjb",
        });
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({ id, type: "rounds" }).fetchAsync(),
          1,
          "oplogs"
        );
      });
    });
  });

  describe("when a round exists with that name", function () {
    let id1 = null;
    let id2 = null;
    let ret = null;
    beforeEach(async function () {
      id1 = await Rounds.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        link: "https://puzzlehunt.mit.edu/foo",
        tags: {},
      });
      id2 = await Rounds.insertAsync({
        name: "Bar",
        canon: "bar",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        link: "https://puzzlehunt.mit.edu/foo",
        tags: {},
      });
      ret = await callAs("renameRound", "cjb", {
        id: id1,
        name: "Bar",
      });
    });

    it("returns false", () => chai.assert.isFalse(ret));

    it("leaves round alone", async function () {
      chai.assert.include(await Rounds.findOneAsync(id1), {
        name: "Foo",
        canon: "foo",
        touched: 1,
        touched_by: "torgen",
      });
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          id: { $in: [id1, id2] },
          type: "rounds",
        }).fetchAsync(),
        0
      );
    });
  });
});
