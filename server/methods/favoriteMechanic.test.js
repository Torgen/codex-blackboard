// For side effects
import "/lib/model.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("favoriteMechanic", function () {
  beforeEach(() => resetDatabase());

  it("fails without login", () =>
    chai.assert.throws(
      () => Meteor.call("favoriteMechanic", "cryptic_clues"),
      Match.Error
    ));

  it("fails when no such user", () =>
    chai.assert.throws(
      () => callAs("favoriteMechanic", "cjb", "cryptic_clues"),
      Meteor.Error
    ));

  describe("when user has favorite mechanics", function () {
    beforeEach(() =>
      Meteor.users.insert({
        _id: "torgen",
        favorite_mechanics: ["nikoli_variants"]
      })
    );

    it("adds new mechanic", function () {
      callAs("favoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(Meteor.users.findOne("torgen").favorite_mechanics, [
        "nikoli_variants",
        "cryptic_clues"
      ]);
    });

    it("will not duplicate mechanic", function () {
      callAs("favoriteMechanic", "torgen", "nikoli_variants");
      chai.assert.deepEqual(Meteor.users.findOne("torgen").favorite_mechanics, [
        "nikoli_variants"
      ]);
    });

    it("rejects bad mechanic", () =>
      chai.assert.throws(
        () => callAs("favoriteMechanic", "torgen", "minesweeper"),
        Match.Error
      ));
  });

  describe("when user has no favorite mechanics", function () {
    beforeEach(() =>
      Meteor.users.insert({
        _id: "torgen"
      })
    );

    it("creates favorite mechanics", function () {
      callAs("favoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(Meteor.users.findOne("torgen").favorite_mechanics, [
        "cryptic_clues"
      ]);
    });
  });
});
