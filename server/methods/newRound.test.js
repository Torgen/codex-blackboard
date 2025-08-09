// For side effects
import "/lib/model.js";
import { Messages, Puzzles, Roles, Rounds } from "/lib/imports/collections.js";
import { callAs, impersonating } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import isDuplicateError from "/lib/imports/duplicate.js";
import { RoleRenewalTime, RoundUrlPrefix } from "/lib/imports/settings.js";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("newRound", function () {
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  beforeEach(async function () {
    await clearCollections(Messages, Puzzles, Roles, Rounds);
    await RoleRenewalTime.reset();
  });

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("newRound", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
        puzzles: ["yoy"],
      }),
      Match.Error
    );
  });

  describe("when none exists with that name", function () {
    let id = null;
    describe("when onduty", function () {
      beforeEach(async function () {
        await Roles.insertAsync({
          _id: "onduty",
          holder: "torgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        id = (
          await callAs("newRound", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
          })
        )._id;
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({ id, type: "rounds" }).fetchAsync(),
          1
        );
      });

      it("creates round", async function () {
        // Round is created, then drive et al are added
        const round = await Rounds.findOneAsync(id);
        chai.assert.deepInclude(round, {
          name: "Foo",
          canon: "foo",
          created: 7,
          created_by: "torgen",
          touched: 7,
          touched_by: "torgen",
          puzzles: [],
          link: "https://puzzlehunt.mit.edu/foo",
          tags: {},
        });
        ["solved", "solved_by", "drive", "spreadsheet", "doc"].forEach((prop) =>
          chai.assert.notProperty(round, prop)
        );
      });

      it("renews onduty", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "torgen",
          claimed_at: 2,
          renewed_at: 7,
          expires_at: 3600007,
        });
      });
    });

    describe("when someone else is onduty", function () {
      beforeEach(async function () {
        await Roles.insertAsync({
          _id: "onduty",
          holder: "florgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        id = (
          await callAs("newRound", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
          })
        )._id;
      });

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "florgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });

    describe("when nobody is onduty", function () {
      beforeEach(async function () {
        id = (
          await callAs("newRound", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
          })
        )._id;
      });

      it("leaves onduty alone", async function () {
        chai.assert.isNotOk(await Roles.findOneAsync("onduty"));
      });
    });
  });

  describe("with placeholder", function () {
    let round;
    beforeEach(async function () {
      round = await callAs("newRound", "torgen", {
        name: "Foo Round",
        createPlaceholder: true,
      });
    });
    it("has puzzle", async function () {
      chai.assert.equal(round.puzzles.length, 1);
      const actualRound = await Rounds.findOneAsync({ _id: round._id });
      chai.assert.deepEqual(round.puzzles, actualRound.puzzles);
    });
    it("creates puzzle", async function () {
      chai.assert.deepInclude(
        await Puzzles.findOneAsync({ _id: round.puzzles[0] }),
        {
          name: "Foo Round Placeholder",
          canon: "foo_round_placeholder",
          created: 7,
          created_by: "torgen",
          touched: 7,
          touched_by: "torgen",
          puzzles: [],
        }
      );
    });
  });

  it("derives link", async function () {
    await impersonating("cjb", () =>
      RoundUrlPrefix.set("https://testhuntpleaseign.org/rounds")
    );
    const id = (await callAs("newRound", "torgen", { name: "Foo Round" }))._id;
    // Round is created, then drive et al are added
    const round = await Rounds.findOneAsync(id);
    chai.assert.deepInclude(round, {
      name: "Foo Round",
      canon: "foo_round",
      created: 7,
      created_by: "torgen",
      touched: 7,
      touched_by: "torgen",
      puzzles: [],
      link: "https://testhuntpleaseign.org/rounds/foo-round",
      tags: {},
    });
  });

  describe("when one has that name", function () {
    let id1 = null;
    let error = null;
    beforeEach(async function () {
      id1 = await Rounds.insertAsync({
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
      try {
        await callAs("newRound", "cjb", { name: "Foo" });
      } catch (err) {
        error = err;
      }
    });

    it("throws duplicate error", () =>
      chai.assert.isTrue(isDuplicateError(error), `${error}`));

    it("doesn't touch", async function () {
      chai.assert.include(await Rounds.findOneAsync(id1), {
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
      });
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ id: id1, type: "rounds" }).fetchAsync(),
        0
      );
    });
  });
});
