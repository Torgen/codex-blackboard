// For side effects
import "/lib/model.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils";

describe("favoriteMechanic", function () {
  beforeEach(() => clearCollections(Meteor.users));

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("favoriteMechanic", "cryptic_clues"),
      Match.Error
    );
  });

  it("fails when no such user", async function () {
    await assertRejects(
      callAs("favoriteMechanic", "cjb", "cryptic_clues"),
      Meteor.Error
    );
  });

  describe("when user has favorite mechanics", function () {
    beforeEach(async function () {
      await Meteor.users.insertAsync({
        _id: "torgen",
        favorite_mechanics: ["nikoli_variants"],
      });
    });

    it("adds new mechanic", async function () {
      await callAs("favoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics,
        ["nikoli_variants", "cryptic_clues"]
      );
    });

    it("will not duplicate mechanic", async function () {
      await callAs("favoriteMechanic", "torgen", "nikoli_variants");
      chai.assert.deepEqual(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics,
        ["nikoli_variants"]
      );
    });

    it("rejects bad mechanic", async function () {
      await assertRejects(
        callAs("favoriteMechanic", "torgen", "minesweeper"),
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

    it("creates favorite mechanics", async function () {
      await callAs("favoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(
        (await Meteor.users.findOneAsync("torgen")).favorite_mechanics,
        ["cryptic_clues"]
      );
    });
  });
});
