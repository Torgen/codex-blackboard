// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { drive } from "/lib/imports/environment.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

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

  beforeEach(() => resetDatabase());

  describe("when new name is unique", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
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
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(
        () =>
          Meteor.call("renamePuzzle", {
            id,
            name: "Bar",
          }),
        Match.Error
      ));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(() =>
        drive.withValue(
          driveMethods,
          () =>
            (ret = callAs("renamePuzzle", "cjb", {
              id,
              name: "Bar",
            }))
        )
      );

      it("returns true", () => chai.assert.isTrue(ret));

      it("renames puzzle", function () {
        const puzzle = Puzzles.findOne(id);
        return chai.assert.include(puzzle, {
          name: "Bar",
          canon: "bar",
          touched: 7,
          touched_by: "cjb",
        });
      });

      it("renames drive", () =>
        chai.assert.deepEqual(driveMethods.renamePuzzle.getCall(0).args, [
          "Bar",
          "fid",
          "sid",
        ]));

      it("oplogs", () =>
        chai.assert.lengthOf(
          Messages.find({ id, type: "puzzles" }).fetch(),
          1
        ));
    });
  });

  describe("when puzzle with that name exists", function () {
    let id1 = null;
    let id2 = null;
    let ret = null;
    beforeEach(function () {
      id1 = Puzzles.insert({
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
      id2 = Puzzles.insert({
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
      drive.withValue(
        driveMethods,
        () =>
          (ret = callAs("renamePuzzle", "cjb", {
            id: id1,
            name: "Bar",
          }))
      );
    });

    it("returns false", () => chai.assert.isFalse(ret));

    it("leaves puzzle unchanged", () =>
      chai.assert.include(Puzzles.findOne(id1), {
        name: "Foo",
        canon: "foo",
        touched: 1,
        touched_by: "torgen",
      }));

    it("doesn't oplog", () =>
      chai.assert.lengthOf(
        Messages.find({ id: { $in: [id1, id2] }, type: "puzzles" }).fetch(),
        0,
        "oplogs"
      ));

    it("doesn't rename drive", () =>
      chai.assert.equal(driveMethods.renamePuzzle.callCount, 0));
  });
});
