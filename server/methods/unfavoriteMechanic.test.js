// For side effects
import "/lib/model.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("unfavoriteMechanic", function () {
  beforeEach(() => clearCollections(Meteor.users));

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("unfavoriteMechanic", "cryptic_clues"),
      Match.Error
    );
  });

  it("fails when no such user", async function () {
    await assertRejects(
      callAs("unfavoriteMechanic", "cjb", "cryptic_clues"),
      Meteor.Error
    );
  });

  describe("when user has favorite mechanics", async function () {
    beforeEach(async function () {
      await Meteor.users.insertAsync({
        _id: "torgen",
        favorite_mechanics: ["nikoli_variants", "cryptic_clues"],
      });
    });

    it("removes mechanic", async function () {
      await callAs("unfavoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics,
        ["nikoli_variants"]
      );
    });

    it("ignores absent mechanic", async function () {
      await callAs("unfavoriteMechanic", "torgen", "crossword");
      chai.assert.deepEqual(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics,
        ["nikoli_variants", "cryptic_clues"]
      );
    });

    it("rejects bad mechanic", async function () {
      await assertRejects(
        callAs("unfavoriteMechanic", "torgen", "minesweeper"),
        Match.Error
      );
    });
  });

  describe("when user has no favorite mechanics", function () {
    beforeEach(async function () {
      await Meteor.users.insertAsync({
        _id: "torgen",
      });
    });

    it("leaves favorite mechanics absent", async function () {
      await callAs("unfavoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.isUndefined(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics
      );
    });
  });
});
