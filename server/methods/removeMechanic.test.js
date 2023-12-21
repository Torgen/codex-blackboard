// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("removeMechanic", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"]
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it("fails when it doesn't exist", () =>
    chai.assert.throws(
      () => callAs("removeMechanic", "torgen", "id", "cryptic_clues"),
      Meteor.Error
    ));

  describe("to puzzle with empty mechanics", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "cscott",
          touched: 2,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          tags: {
            status: {
              name: "Status",
              value: "stuck",
              touched: 2,
              touched_by: "torgen"
            }
          }
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(
        () => Meteor.call("removeMechanic", id, "cryptic_clues"),
        Match.Error
      ));

    describe("when logged in", function () {
      beforeEach(() => callAs("removeMechanic", "cjb", id, "cryptic_clues"));

      it("does not create mechanics", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.notProperty(doc, "mechanics");
      });

      it("touches", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.include(doc, {
          touched: 7,
          touched_by: "cjb"
        });
      });
    });
  });

  describe("to puzzle with mechanics", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "cscott",
          touched: 2,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          tags: {
            status: {
              name: "Status",
              value: "stuck",
              touched: 2,
              touched_by: "torgen"
            }
          },
          mechanics: ["nikoli_variants", "runaround"]
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(
        () => Meteor.call("removeMechanic", id, "cryptic_clues"),
        Match.Error
      ));

    describe("when logged in", function () {
      it("fails with invalid mechanic", () =>
        chai.assert.throws(
          () => callAs("removeMechanic", "torgen", id, "eating_contest"),
          Match.Error
        ));

      describe("with new mechanic", function () {
        beforeEach(() => callAs("removeMechanic", "cjb", id, "cryptic_clues"));

        it("does not change mechanics", function () {
          const doc = Puzzles.findOne(id);
          chai.assert.deepInclude(doc, {
            mechanics: ["nikoli_variants", "runaround"]
          });
        });

        it("touches", function () {
          const doc = Puzzles.findOne(id);
          chai.assert.include(doc, {
            touched: 7,
            touched_by: "cjb"
          });
        });
      });

      describe("with existing mechanic", function () {
        beforeEach(() =>
          callAs("removeMechanic", "cjb", id, "nikoli_variants")
        );

        it("removes mechanic", function () {
          const doc = Puzzles.findOne(id);
          chai.assert.deepInclude(doc, { mechanics: ["runaround"] });
        });

        it("touches", function () {
          const doc = Puzzles.findOne(id);
          chai.assert.include(doc, {
            touched: 7,
            touched_by: "cjb"
          });
        });
      });
    });
  });
});
