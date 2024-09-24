// For side effects
import "/lib/model.js";
import { Messages, Puzzles, Roles, Rounds } from "/lib/imports/collections.js";
import { callAs, impersonating } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import isDuplicateError from "/lib/imports/duplicate.js";
import { drive } from "/lib/imports/environment.js";
import { PuzzleUrlPrefix, RoleRenewalTime } from "/lib/imports/settings.js";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("newPuzzle", function () {
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

  beforeEach(async function () {
    await clearCollections(Messages, Puzzles, Roles, Rounds);
    await RoleRenewalTime.reset();
  });

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("newPuzzle", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
      }),
      Match.Error
    );
  });

  describe("when none exists with that name", function () {
    let round = null;
    let id = null;
    describe("when onduty", function () {
      beforeEach(async function () {
        round = await Rounds.insertAsync({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        await Roles.insertAsync({
          _id: "onduty",
          holder: "torgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        await drive.withValue(driveMethods, async function () {
          id = (
            await callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })
          )._id;
        });
      });

      it("creates puzzle", async function () {
        chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
          name: "Foo",
          canon: "foo",
          created: 7,
          created_by: "torgen",
          touched: 7,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          link: "https://puzzlehunt.mit.edu/foo",
          drive: "fid",
          spreadsheet: "sid",
          tags: {},
        });
      });

      it("adds puzzle to round", async function () {
        chai.assert.deepInclude(await Rounds.findOneAsync(round), {
          touched: 7,
          touched_by: "torgen",
          puzzles: [id],
        });
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({ id, type: "puzzles" }).fetchAsync(),
          1
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
        round = await Rounds.insertAsync({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        await Roles.insertAsync({
          _id: "onduty",
          holder: "florgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        await drive.withValue(driveMethods, async function () {
          id = (
            await callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })
          )._id;
        });
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
        round = await Rounds.insertAsync({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        await drive.withValue(driveMethods, async function () {
          id = (
            await callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })
          )._id;
        });
      });

      it("leaves onduty alone", async function () {
        chai.assert.isNotOk(await Roles.findOneAsync("onduty"));
      });
    });
  });

  describe("with mechanics", function () {
    let round = null;
    beforeEach(async function () {
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [],
      });
    });

    it("dedupes mechanics", async function () {
      await drive.withValue(driveMethods, async function () {
        const id = (
          await callAs("newPuzzle", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
            round,
            mechanics: ["crossword", "crossword", "cryptic_clues"],
          })
        )._id;
        chai.assert.deepEqual((await Puzzles.findOneAsync(id)).mechanics, [
          "crossword",
          "cryptic_clues",
        ]);
      });
    });

    it("rejects bad mechanics", async function () {
      await assertRejects(
        callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round,
          mechanics: ["acrostic"],
        }),
        Match.Error
      );
    });
  });

  it("derives link", async function () {
    await drive.withValue(driveMethods, async function () {
      await impersonating("cjb", () =>
        PuzzleUrlPrefix.set("https://testhuntpleaseign.org/puzzles")
      );
      const round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [],
      });
      const id = (
        await callAs("newPuzzle", "torgen", {
          name: "Foo Puzzle",
          round,
        })
      )._id;
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        name: "Foo Puzzle",
        canon: "foo_puzzle",
        created: 7,
        created_by: "torgen",
        touched: 7,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://testhuntpleaseign.org/puzzles/foo-puzzle",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
      });
    });
  });

  describe("when one exists with that name", function () {
    var round = round;
    let id1 = null;
    let error = null;
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
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
      });
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [id1],
      });
      try {
        await drive.withValue(driveMethods, () =>
          callAs("newPuzzle", "cjb", {
            name: "Foo",
            round,
          })
        );
      } catch (err) {
        error = err;
      }
    });

    it("throws duplicate error", function () {
      chai.assert.isTrue(isDuplicateError(error), `${error}`);
    });

    it("doesn't touch", async function () {
      chai.assert.include(await Puzzles.findOneAsync(id1), {
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
      });
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ id: id1, type: "puzzles" }).fetchAsync(),
        0
      );
    });
  });

  describe("when drive fails", function () {
    let round = null;
    beforeEach(async function () {
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [],
      });
      driveMethods.createPuzzle = sinon.fake.throws("user limits");
    });

    it("sets status", async function () {
      await drive.withValue(driveMethods, async function () {
        const id = (
          await callAs("newPuzzle", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
            round,
          })
        )._id;
        chai.assert.include(await Puzzles.findOneAsync(id), {
          drive_status: "failed",
          drive_error_message: "Error: user limits",
        });
      });
    });
  });

  describe("when round does not exist", function () {
    let err = null;
    beforeEach(async function () {
      try {
        await callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round: "nonsuch",
        });
      } catch (e) {
        err = e;
      }
    });
    it("throws error", function () {
      chai.assert.isOk(err);
    });
    it("does not create puzzle", async function () {
      chai.assert.isNotOk(await Puzzles.findOneAsync({ name: "Foo" }));
    });
  });

  describe("when a meta does not exist", function () {
    let err = null;
    let round = null;
    let meta = null;
    beforeEach(async function () {
      meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/meta",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
        puzzles: [],
        feedsInto: [],
      });
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [meta],
      });
      try {
        await callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round,
          feedsInto: [meta, "nonsuch"],
        });
      } catch (e) {
        err = e;
      }
    });
    it("throws error", function () {
      chai.assert.isOk(err);
    });
    it("does not create puzzle", async function () {
      chai.assert.isNotOk(await Puzzles.findOneAsync({ name: "Foo" }));
    });
    it("does not modify round", async function () {
      chai.assert.deepEqual((await Rounds.findOneAsync(round)).puzzles, [meta]);
    });
    it("does not modify existing meta", async function () {
      chai.assert.isEmpty((await Puzzles.findOneAsync(meta)).puzzles);
    });
  });

  describe("when a meta is duplicated", function () {
    let round = null;
    let meta = null;
    let puzzle = null;
    beforeEach(async function () {
      meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/meta",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
        puzzles: [],
        feedsInto: [],
      });
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [meta],
      });
      puzzle = await callAs("newPuzzle", "torgen", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
        round,
        feedsInto: [meta, meta],
      });
    });
    it("adds to round", async function () {
      chai.assert.deepEqual((await Rounds.findOneAsync(round)).puzzles, [
        meta,
        puzzle._id,
      ]);
    });
    it("feeds meta once", async function () {
      chai.assert.deepEqual((await Puzzles.findOneAsync(meta)).puzzles, [
        puzzle._id,
      ]);
    });
    it("deduplicates metas", async function () {
      chai.assert.deepEqual(
        (await Puzzles.findOneAsync(puzzle._id)).feedsInto,
        [meta]
      );
    });
  });

  describe("when a feeder does not exist", function () {
    let err = null;
    let round = null;
    let feeder = null;
    beforeEach(async function () {
      feeder = await Puzzles.insertAsync({
        name: "Feeder",
        canon: "feeder",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/feeder",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
        feedsInto: [],
      });
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [feeder],
      });
      try {
        await callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round,
          puzzles: [feeder, "nonsuch"],
        });
      } catch (e) {
        err = e;
      }
    });
    it("throws error", function () {
      chai.assert.isOk(err);
    });
    it("does not create puzzle", async function () {
      chai.assert.isNotOk(await Puzzles.findOneAsync({ name: "Foo" }));
    });
    it("does not modify existing feeder", async function () {
      chai.assert.isEmpty((await Puzzles.findOneAsync(feeder)).feedsInto);
    });
    it("does not modify round", async function () {
      chai.assert.deepEqual((await Rounds.findOneAsync(round)).puzzles, [
        feeder,
      ]);
    });
  });

  describe("when a feeder is duplicated", function () {
    let round = null;
    let feeder = null;
    let puzzle = null;
    beforeEach(async function () {
      feeder = await Puzzles.insertAsync({
        name: "Feeder",
        canon: "feeder",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/feeder",
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
        feedsInto: [],
      });
      round = await Rounds.insertAsync({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [feeder],
      });
      puzzle = await callAs("newPuzzle", "torgen", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
        round,
        puzzles: [feeder, feeder],
      });
    });
    it("adds to round", async function () {
      chai.assert.deepEqual((await Rounds.findOneAsync(round)).puzzles, [
        feeder,
        puzzle._id,
      ]);
    });
    it("is fed once", async function () {
      chai.assert.deepEqual((await Puzzles.findOneAsync(feeder)).feedsInto, [
        puzzle._id,
      ]);
    });
    it("deduplicates metas", async function () {
      chai.assert.deepEqual((await Puzzles.findOneAsync(puzzle._id)).puzzles, [
        feeder,
      ]);
    });
  });
});
