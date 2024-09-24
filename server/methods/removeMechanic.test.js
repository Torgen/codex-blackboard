// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("removeMechanic", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Puzzles));

  it("fails when it doesn't exist", async function () {
    await assertRejects(
      callAs("removeMechanic", "torgen", "id", "cryptic_clues"),
      Meteor.Error
    );
  });

  describe("to puzzle with empty mechanics", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
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
            touched_by: "torgen",
          },
        },
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("removeMechanic", id, "cryptic_clues"),
        Match.Error
      );
    });

    describe("when logged in", function () {
      beforeEach(async function () {
        await callAs("removeMechanic", "cjb", id, "cryptic_clues");
      });

      it("does not create mechanics", async function () {
        const doc = await Puzzles.findOneAsync(id);
        chai.assert.notProperty(doc, "mechanics");
      });

      it("touches", async function () {
        const doc = await Puzzles.findOneAsync(id);
        chai.assert.include(doc, {
          touched: 7,
          touched_by: "cjb",
        });
      });
    });
  });

  describe("to puzzle with mechanics", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
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
            touched_by: "torgen",
          },
        },
        mechanics: ["nikoli_variants", "runaround"],
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("removeMechanic", id, "cryptic_clues"),
        Match.Error
      );
    });

    describe("when logged in", function () {
      it("fails with invalid mechanic", async function () {
        await assertRejects(
          callAs("removeMechanic", "torgen", id, "eating_contest"),
          Match.Error
        );
      });

      describe("with new mechanic", function () {
        beforeEach(async function () {
          await callAs("removeMechanic", "cjb", id, "cryptic_clues");
        });

        it("does not change mechanics", async function () {
          const doc = await Puzzles.findOneAsync(id);
          chai.assert.deepInclude(doc, {
            mechanics: ["nikoli_variants", "runaround"],
          });
        });

        it("touches", async function () {
          const doc = await Puzzles.findOneAsync(id);
          chai.assert.include(doc, {
            touched: 7,
            touched_by: "cjb",
          });
        });
      });

      describe("with existing mechanic", function () {
        beforeEach(async function () {
          await callAs("removeMechanic", "cjb", id, "nikoli_variants");
        });

        it("removes mechanic", async function () {
          const doc = await Puzzles.findOneAsync(id);
          chai.assert.deepInclude(doc, { mechanics: ["runaround"] });
        });

        it("touches", async function () {
          const doc = await Puzzles.findOneAsync(id);
          chai.assert.include(doc, {
            touched: 7,
            touched_by: "cjb",
          });
        });
      });
    });
  });
});
