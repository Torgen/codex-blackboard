// For side effects
import "/lib/model.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("unfavoriteMechanic", function () {
  beforeEach(() => resetDatabase());

  it("fails without login", () =>
    chai.assert.throws(
      () => Meteor.call("unfavoriteMechanic", "cryptic_clues"),
      Match.Error,
    ));

  it("fails when no such user", () =>
    chai.assert.throws(
      () => callAs("unfavoriteMechanic", "cjb", "cryptic_clues"),
      Meteor.Error,
    ));

  describe("when user has favorite mechanics", function () {
    beforeEach(() =>
      Meteor.users.insert({
        _id: "torgen",
        favorite_mechanics: ["nikoli_variants", "cryptic_clues"],
      }),
    );

    it("removes mechanic", function () {
      callAs("unfavoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.deepEqual(Meteor.users.findOne("torgen").favorite_mechanics, [
        "nikoli_variants",
      ]);
    });

    it("ignores absent mechanic", function () {
      callAs("unfavoriteMechanic", "torgen", "crossword");
      chai.assert.deepEqual(Meteor.users.findOne("torgen").favorite_mechanics, [
        "nikoli_variants",
        "cryptic_clues",
      ]);
    });

    it("rejects bad mechanic", () =>
      chai.assert.throws(
        () => callAs("unfavoriteMechanic", "torgen", "minesweeper"),
        Match.Error,
      ));
  });

  describe("when user has no favorite mechanics", function () {
    beforeEach(() =>
      Meteor.users.insert({
        _id: "torgen",
      }),
    );

    it("leaves favorite mechanics absent", function () {
      callAs("unfavoriteMechanic", "torgen", "cryptic_clues");
      chai.assert.isUndefined(
        Meteor.users.findOne("torgen").favorite_mechanics,
      );
    });
  });
});
