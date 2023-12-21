// For side effetcs
import "/lib/model.js";
import { Puzzles, Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

const testCase = (method, collection) =>
  describe(method, function () {
    let clock = null;

    beforeEach(
      () =>
        (clock = sinon.useFakeTimers({
          now: 7,
          toFake: ["Date"]
        }))
    );

    afterEach(() => clock.restore());

    beforeEach(function () {
      resetDatabase();

      collection.insert({
        _id: "parent",
        puzzles: ["c1", "c2", "c3", "c4"],
        created_by: "cjb",
        created: 4,
        touched_by: "cjb",
        touched: 4
      });
    });

    it("fails without login", () =>
      chai.assert.throws(
        () => Meteor.call(method, "parent", "c1", { pos: 1 }),
        Match.Error
      ));

    it("fails when parent doesn't exist", () =>
      chai.assert.isFalse(
        callAs(method, "torgen", "nosuch", "child", { pos: 1 })
      ));

    it("fails when child doesn't exist", function () {
      chai.assert.isFalse(callAs(method, "torgen", "c5", "parent", { pos: 1 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4
      });
    });

    it("moves down one", function () {
      chai.assert.isTrue(callAs(method, "torgen", "c2", "parent", { pos: 1 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("moves up one", function () {
      chai.assert.isTrue(callAs(method, "torgen", "c3", "parent", { pos: -1 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("moves down several", function () {
      chai.assert.isTrue(callAs(method, "torgen", "c2", "parent", { pos: 2 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c3", "c4", "c2"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("moves up several", function () {
      chai.assert.isTrue(callAs(method, "torgen", "c3", "parent", { pos: -2 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c3", "c1", "c2", "c4"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("fails to move past end", function () {
      chai.assert.isFalse(callAs(method, "torgen", "c4", "parent", { pos: 1 }));
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4
      });
    });

    it("fails to move past start", function () {
      chai.assert.isFalse(
        callAs(method, "torgen", "c1", "parent", { pos: -1 })
      );
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4
      });
    });

    it("moves before", function () {
      chai.assert.isTrue(
        callAs(method, "torgen", "c2", "parent", { before: "c4" })
      );
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("moves after", function () {
      chai.assert.isTrue(
        callAs(method, "torgen", "c3", "parent", { after: "c1" })
      );
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c3", "c2", "c4"],
        touched_by: "torgen",
        touched: 7
      });
    });

    it("fails to move before absent", function () {
      chai.assert.isFalse(
        callAs(method, "torgen", "c2", "parent", { before: "c5" })
      );
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4
      });
    });

    it("fails to move after absent", function () {
      chai.assert.isFalse(
        callAs(method, "torgen", "c3", "parent", { after: "c5" })
      );
      chai.assert.deepInclude(collection.findOne("parent"), {
        puzzles: ["c1", "c2", "c3", "c4"],
        touched_by: "cjb",
        touched: 4
      });
    });
  });

testCase("moveWithinMeta", Puzzles);
testCase("moveWithinRound", Rounds);
