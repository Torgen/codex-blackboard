// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { drive } from "/lib/imports/environment.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("renamePuzzle", function () {
  let driveMethods = null;
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
    driveMethods = {
      createPuzzle: sinon.fake.returns({
        id: "fid", // f for folder
        spreadId: "sid",
      }),
      renamePuzzle: sinon.spy(),
      deletePuzzle: sinon.spy(),
    };
  });

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  beforeEach(() => clearCollections(Messages, Puzzles));

  describe("when new name is unique", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("renamePuzzle", {
          id,
          name: "Bar",
        }),
        Match.Error
      );
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        await drive.withValue(driveMethods, async function () {
          ret = await callAs("renamePuzzle", "cjb", {
            id,
            name: "Bar",
          });
        });
      });

      it("returns true", function () {
        chai.assert.isTrue(ret);
      });

      it("renames puzzle", async function () {
        const puzzle = await Puzzles.findOneAsync(id);
        return chai.assert.include(puzzle, {
          name: "Bar",
          canon: "bar",
          touched: 7,
          touched_by: "cjb",
        });
      });

      it("renames drive", function () {
        chai.assert.deepEqual(driveMethods.renamePuzzle.getCall(0).args, [
          "Bar",
          "fid",
          "sid",
        ]);
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({ id, type: "puzzles" }).fetchAsync(),
          1
        );
      });
    });
  });

  describe("when puzzle with that name exists", function () {
    let id1 = null;
    let id2 = null;
    let ret = null;
    beforeEach(async function () {
      id1 = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "f1",
        spreadsheet: "s1",
        tags: {},
      });
      id2 = await Puzzles.insertAsync({
        name: "Bar",
        canon: "bar",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "f2",
        spreadsheet: "s2",
        tags: {},
      });
      await drive.withValue(driveMethods, async function () {
        ret = await callAs("renamePuzzle", "cjb", {
          id: id1,
          name: "Bar",
        });
      });
    });

    it("returns false", () => chai.assert.isFalse(ret));

    it("leaves puzzle unchanged", async function () {
      chai.assert.include(await Puzzles.findOneAsync(id1), {
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
          type: "puzzles",
        }).fetchAsync(),
        0,
        "oplogs"
      );
    });

    it("doesn't rename drive", () =>
      chai.assert.equal(driveMethods.renamePuzzle.callCount, 0));
  });
});
