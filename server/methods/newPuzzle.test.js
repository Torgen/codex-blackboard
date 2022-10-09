// For side effects
import "/lib/model.js";
import { Messages, Puzzles, Roles, Rounds } from "/lib/imports/collections.js";
import { callAs, impersonating } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import isDuplicateError from "/lib/imports/duplicate.js";
import { drive } from "/lib/imports/environment.js";
import {
  PuzzleUrlPrefix,
  RoleRenewalTime,
  UrlSeparator,
} from "/lib/imports/settings.js";

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

  beforeEach(function () {
    resetDatabase();
    PuzzleUrlPrefix.ensure();
    RoleRenewalTime.ensure();
    UrlSeparator.ensure();
  });

  it("fails without login", () =>
    chai.assert.throws(
      () =>
        Meteor.call("newPuzzle", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
        }),
      Match.Error
    ));

  describe("when none exists with that name", function () {
    let round = null;
    let id = null;
    describe("when onduty", function () {
      beforeEach(function () {
        round = Rounds.insert({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        Roles.insert({
          _id: "onduty",
          holder: "torgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        drive.withValue(
          driveMethods,
          () =>
            (id = callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })._id)
        );
      });

      it("creates puzzle", () =>
        chai.assert.deepInclude(Puzzles.findOne(id), {
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
        }));

      it("adds puzzle to round", () =>
        chai.assert.deepInclude(Rounds.findOne(round), {
          touched: 7,
          touched_by: "torgen",
          puzzles: [id],
        }));

      it("oplogs", () =>
        chai.assert.lengthOf(
          Messages.find({ id, type: "puzzles" }).fetch(),
          1
        ));

      it("renews onduty", () =>
        chai.assert.deepInclude(Roles.findOne("onduty"), {
          holder: "torgen",
          claimed_at: 2,
          renewed_at: 7,
          expires_at: 3600007,
        }));
    });

    describe("when someone else is onduty", function () {
      beforeEach(function () {
        round = Rounds.insert({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        Roles.insert({
          _id: "onduty",
          holder: "florgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
        drive.withValue(
          driveMethods,
          () =>
            (id = callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })._id)
        );
      });

      it("leaves onduty alone", () =>
        chai.assert.deepInclude(Roles.findOne("onduty"), {
          holder: "florgen",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        }));
    });

    describe("when nobody is onduty", function () {
      beforeEach(function () {
        round = Rounds.insert({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        });
        drive.withValue(
          driveMethods,
          () =>
            (id = callAs("newPuzzle", "torgen", {
              name: "Foo",
              link: "https://puzzlehunt.mit.edu/foo",
              round,
            })._id)
        );
      });

      it("leaves onduty alone", () =>
        chai.assert.isNotOk(Roles.findOne("onduty")));
    });
  });

  describe("with mechanics", function () {
    let round = null;
    beforeEach(
      () =>
        (round = Rounds.insert({
          name: "Round",
          canon: "round",
          created: 1,
          created_by: "cjb",
          touched: 1,
          touched_by: "cjb",
          puzzles: [],
        }))
    );

    it("dedupes mechanics", () =>
      drive.withValue(driveMethods, function () {
        const id = callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round,
          mechanics: ["crossword", "crossword", "cryptic_clues"],
        })._id;
        chai.assert.deepEqual(Puzzles.findOne(id).mechanics, [
          "crossword",
          "cryptic_clues",
        ]);
      }));

    it("rejects bad mechanics", () =>
      chai.assert.throws(
        () =>
          callAs("newPuzzle", "torgen", {
            name: "Foo",
            link: "https://puzzlehunt.mit.edu/foo",
            round,
            mechanics: ["acrostic"],
          }),
        Match.Error
      ));
  });

  it("derives link", () =>
    drive.withValue(driveMethods, function () {
      impersonating("cjb", () =>
        PuzzleUrlPrefix.set("https://testhuntpleaseign.org/puzzles")
      );
      const round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [],
      });
      const id = callAs("newPuzzle", "torgen", {
        name: "Foo Puzzle",
        round,
      })._id;
      chai.assert.deepInclude(Puzzles.findOne(id), {
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
    }));

  describe("when one exists with that name", function () {
    var round = round;
    let id1 = null;
    let error = null;
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
        drive: "fid",
        spreadsheet: "sid",
        tags: {},
      });
      round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [id1],
      });
      try {
        drive.withValue(driveMethods, () =>
          callAs("newPuzzle", "cjb", {
            name: "Foo",
            round,
          })
        );
      } catch (err) {
        error = err;
      }
    });

    it("throws duplicate error", () =>
      chai.assert.isTrue(isDuplicateError(error), `${error}`));

    it("doesn't touch", () =>
      chai.assert.include(Puzzles.findOne(id1), {
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
      }));

    it("doesn't oplog", () =>
      chai.assert.lengthOf(
        Messages.find({ id: id1, type: "puzzles" }).fetch(),
        0
      ));
  });

  describe("when drive fails", function () {
    let round = null;
    beforeEach(function () {
      round = Rounds.insert({
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

    it("sets status", () =>
      drive.withValue(driveMethods, function () {
        const id = callAs("newPuzzle", "torgen", {
          name: "Foo",
          link: "https://puzzlehunt.mit.edu/foo",
          round,
        })._id;
        chai.assert.include(Puzzles.findOne(id), {
          drive_status: "failed",
          drive_error_message: "Error: user limits",
        });
      }));
  });

  describe("when round does not exist", function () {
    let err = null;
    beforeEach(function () {
      try {
        callAs("newPuzzle", "torgen", {
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
    it("does not create puzzle", function () {
      chai.assert.isNotOk(Puzzles.findOne({ name: "Foo" }));
    });
  });

  describe("when a meta does not exist", function () {
    let err = null;
    let round = null;
    let meta = null;
    beforeEach(function () {
      meta = Puzzles.insert({
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
      round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [meta],
      });
      try {
        callAs("newPuzzle", "torgen", {
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
    it("does not create puzzle", function () {
      chai.assert.isNotOk(Puzzles.findOne({ name: "Foo" }));
    });
    it("does not modify round", function () {
      chai.assert.deepEqual(Rounds.findOne(round).puzzles, [meta]);
    });
    it("does not modify existing meta", function () {
      chai.assert.isEmpty(Puzzles.findOne(meta).puzzles);
    });
  });

  describe("when a meta is duplicated", function () {
    let round = null;
    let meta = null;
    let puzzle = null;
    beforeEach(function () {
      meta = Puzzles.insert({
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
      round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [meta],
      });
      puzzle = callAs("newPuzzle", "torgen", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
        round,
        feedsInto: [meta, meta],
      });
    });
    it("adds to round", function () {
      chai.assert.deepEqual(Rounds.findOne(round).puzzles, [meta, puzzle._id]);
    });
    it("feeds meta once", function () {
      chai.assert.deepEqual(Puzzles.findOne(meta).puzzles, [puzzle._id]);
    });
    it("deduplicates metas", function () {
      chai.assert.deepEqual(Puzzles.findOne(puzzle._id).feedsInto, [meta]);
    });
  });

  describe("when a feeder does not exist", function () {
    let err = null;
    let round = null;
    let feeder = null;
    beforeEach(function () {
      feeder = Puzzles.insert({
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
      round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [feeder],
      });
      try {
        callAs("newPuzzle", "torgen", {
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
    it("does not create puzzle", function () {
      chai.assert.isNotOk(Puzzles.findOne({ name: "Foo" }));
    });
    it("does not modify existing feeder", function () {
      chai.assert.isEmpty(Puzzles.findOne(feeder).feedsInto);
    });
    it("does not modify round", function () {
      chai.assert.deepEqual(Rounds.findOne(round).puzzles, [feeder]);
    });
  });

  describe("when a feeder is duplicated", function () {
    let round = null;
    let feeder = null;
    let puzzle = null;
    beforeEach(function () {
      feeder = Puzzles.insert({
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
      round = Rounds.insert({
        name: "Round",
        canon: "round",
        created: 1,
        created_by: "cjb",
        touched: 1,
        touched_by: "cjb",
        puzzles: [feeder],
      });
      puzzle = callAs("newPuzzle", "torgen", {
        name: "Foo",
        link: "https://puzzlehunt.mit.edu/foo",
        round,
        puzzles: [feeder, feeder],
      });
    });
    it("adds to round", function () {
      chai.assert.deepEqual(Rounds.findOne(round).puzzles, [
        feeder,
        puzzle._id,
      ]);
    });
    it("is fed once", function () {
      chai.assert.deepEqual(Puzzles.findOne(feeder).feedsInto, [puzzle._id]);
    });
    it("deduplicates metas", function () {
      chai.assert.deepEqual(Puzzles.findOne(puzzle._id).puzzles, [feeder]);
    });
  });
});
