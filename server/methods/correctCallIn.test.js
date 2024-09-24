// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles, Roles } from "/lib/imports/collections.js";
// Test only works on server side; move to /server if you add client tests.
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { RoleRenewalTime } from "/lib/imports/settings.js";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("correctCallIn", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(async function () {
    await clearCollections(CallIns, Messages, Puzzles, Roles);
    await RoleRenewalTime.reset();
  });

  let puzzle = null;
  let callin = null;
  it("fails when callin doesn't exist", async function () {
    assertRejects(
      callAs("correctCallIn", "cjb", "never heard of it"),
      Meteor.Error
    );
  });

  describe("for answer", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "answer",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      await Roles.insertAsync({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 2,
        renewed_at: 2,
        expires_at: 3600002,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin),
        Match.Error
      );
    });

    it("fails with response", async function () {
      await assertRejects(
        callAs("correctCallIn", "cjb", callin, "close enough"),
        Match.Error
      );
    });

    describe("when logged in", function () {
      beforeEach(() => callAs("correctCallIn", "cjb", callin));

      it("updates puzzle", async function () {
        const doc = await Puzzles.findOneAsync(puzzle);
        chai.assert.deepInclude(doc, {
          touched: 7,
          touched_by: "cjb",
          solved: 7,
          solved_by: "torgen",
          confirmed_by: "cjb",
          tags: {
            answer: {
              name: "Answer",
              value: "precipitate",
              touched: 7,
              touched_by: "cjb",
            },
          },
        });
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, {
          status: "accepted",
          resolved: 7,
        });
      });

      it("oplogs", async function () {
        const o = await Messages.find({
          room_name: "oplog/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          type: "puzzles",
          id: puzzle,
          stream: "answers",
          nick: "cjb",
        });
        chai.assert.include(o[0].body, "(PRECIPITATE)", "message");
      });

      it("notifies puzzle chat", async function () {
        const o = await Messages.find({
          room_name: `puzzles/${puzzle}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "PRECIPITATE", "message");
        chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
      });

      it("notifies general chat", async function () {
        const o = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "PRECIPITATE", "message");
        chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
      });

      it("renews onduty", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 7,
          expires_at: 3600007,
        });
      });
    });

    describe("when not onduty", function () {
      beforeEach(() => callAs("correctCallIn", "cscott", callin));

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });

    it("notifies meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 1);
      chai.assert.include(m[0], {
        nick: "cjb",
        action: true,
      });
      chai.assert.include(m[0].body, "PRECIPITATE");
      chai.assert.include(m[0].body, `(#puzzles/${puzzle})`);
    });

    it("notifies feeder chat for puzzle", async function () {
      const feeder = await Puzzles.insertAsync({
        name: "Feeder",
        canon: "feeder",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { puzzles: feeder } });
      await callAs("correctCallIn", "cjb", callin);
      const m = await Messages.find({
        room_name: `puzzles/${feeder}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 1);
      chai.assert.include(m[0], {
        nick: "cjb",
        action: true,
      });
      chai.assert.include(m[0].body, "PRECIPITATE");
      chai.assert.include(m[0].body, `(#puzzles/${puzzle})`);
    });
  });

  describe("for first partial answer", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "partial answer",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      await Roles.insertAsync({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 2,
        renewed_at: 2,
        expires_at: 3600002,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin),
        Match.Error
      );
    });

    it("fails with string response", async function () {
      await assertRejects(
        callAs("correctCallIn", "cjb", callin, "close enough"),
        Match.Error
      );
    });

    describe("when logged in", function () {
      describe("when not final", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin, false));

        it("updates puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 7,
            touched_by: "cjb",
            answers: ["precipitate"],
            solved: null,
            solved_by: null,
            confirmed_by: null,
            last_partial_answer: 7,
          });
          chai.assert.doesNotHaveAnyKeys(doc.tags, ["answer"]);
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("oplogs", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            type: "puzzles",
            id: puzzle,
            stream: "answers",
            nick: "cjb",
          });
          chai.assert.include(o[0].body, "(PRECIPITATE)", "message");
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("renews onduty", async function () {
          chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
            holder: "cjb",
            claimed_at: 2,
            renewed_at: 7,
            expires_at: 3600007,
          });
        });
      });

      describe("when final", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin, true));

        it("updates puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 7,
            touched_by: "cjb",
            solved: 7,
            solved_by: "torgen",
            confirmed_by: "cjb",
            tags: {
              answer: {
                name: "Answer",
                value: "precipitate",
                touched: 7,
                touched_by: "cjb",
              },
            },
          });
          chai.assert.doesNotHaveAnyKeys(doc, ["answers"]);
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
            callin_type: "answer",
          });
        });

        it("oplogs", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            type: "puzzles",
            id: puzzle,
            stream: "answers",
            nick: "cjb",
          });
          chai.assert.include(o[0].body, "(PRECIPITATE)", "message");
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("renews onduty", async function () {
          chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
            holder: "cjb",
            claimed_at: 2,
            renewed_at: 7,
            expires_at: 3600007,
          });
        });
      });
    });

    describe("when not onduty", function () {
      beforeEach(() => callAs("correctCallIn", "cscott", callin, false));

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });

    it("notifies meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin, false);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 1);
      chai.assert.include(m[0], {
        nick: "cjb",
        action: true,
      });
      chai.assert.include(m[0].body, "PRECIPITATE");
      chai.assert.include(m[0].body, `(#puzzles/${puzzle})`);
    });
  });

  describe("for later partial answer", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        answers: ["sedimentary", "igneous"],
        last_partial_answer: 6,
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "partial answer",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      await Roles.insertAsync({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 2,
        renewed_at: 2,
        expires_at: 3600002,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin, false),
        Match.Error
      );
    });

    it("fails with string response", async function () {
      await assertRejects(
        callAs("correctCallIn", "cjb", callin, "close enough"),
        Match.Error
      );
    });

    describe("when logged in", function () {
      describe("when not final", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin, false));

        it("updates puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 7,
            touched_by: "cjb",
            answers: ["sedimentary", "igneous", "precipitate"],
            solved: null,
            solved_by: null,
            confirmed_by: null,
            last_partial_answer: 7,
          });
          chai.assert.doesNotHaveAnyKeys(doc.tags, ["answer"]);
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("oplogs", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            type: "puzzles",
            id: puzzle,
            stream: "answers",
            nick: "cjb",
          });
          chai.assert.include(o[0].body, "(PRECIPITATE)", "message");
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("renews onduty", async function () {
          chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
            holder: "cjb",
            claimed_at: 2,
            renewed_at: 7,
            expires_at: 3600007,
          });
        });
      });

      describe("when final", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin, true));

        it("updates puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 7,
            touched_by: "cjb",
            solved: 7,
            solved_by: "torgen",
            confirmed_by: "cjb",
            last_partial_answer: 7,
            tags: {
              answer: {
                name: "Answer",
                value: "igneous; precipitate; sedimentary",
                touched: 7,
                touched_by: "cjb",
              },
            },
            answers: ["sedimentary", "igneous", "precipitate"],
          });
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("oplogs", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            type: "puzzles",
            id: puzzle,
            stream: "answers",
            nick: "cjb",
          });
          chai.assert.include(o[0].body, "(PRECIPITATE)", "message");
          chai.assert.notInclude(o[0].body, "SEDIMENTARY", "message");
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.notInclude(o[0].body, "SEDIMENTARY", "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "PRECIPITATE", "message");
          chai.assert.notInclude(o[0].body, "SEDIMENTARY", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("renews onduty", async function () {
          chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
            holder: "cjb",
            claimed_at: 2,
            renewed_at: 7,
            expires_at: 3600007,
          });
        });
      });
    });

    describe("when not onduty", function () {
      beforeEach(() => callAs("correctCallIn", "cscott", callin, false));

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });

    it("notifies meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin, false);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 1);
      chai.assert.include(m[0], {
        nick: "cjb",
        action: true,
      });
      chai.assert.include(m[0].body, "PRECIPITATE");
      chai.assert.include(m[0].body, `(#puzzles/${puzzle})`);
    });

    it("notifies feeder chat for final answer", async function () {
      const feeder = await Puzzles.insertAsync({
        name: "Feeder",
        canon: "feeder",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { puzzles: feeder } });
      await callAs("correctCallIn", "cjb", callin, true);
      const m = await Messages.find({
        room_name: `puzzles/${feeder}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 1);
      chai.assert.include(m[0], {
        nick: "cjb",
        action: true,
      });
      chai.assert.include(m[0].body, "PRECIPITATE");
      chai.assert.include(m[0].body, `(#puzzles/${puzzle})`);
    });
  });

  describe("for interaction request", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "interaction request",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin),
        Match.Error
      );
    });

    describe("when logged in", () =>
      describe("without response", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin));

        it("does not update puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 1,
            touched_by: "cscott",
            solved: null,
            solved_by: null,
            confirmed_by: null,
            tags: {},
          });
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 0);
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "ACCEPTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      }));

    describe("with response", function () {
      beforeEach(() =>
        callAs(
          "correctCallIn",
          "cjb",
          callin,
          "Make us some supersaturated Kool-Aid"
        )
      );

      it("does not update puzzle", async function () {
        const doc = await Puzzles.findOneAsync(puzzle);
        chai.assert.deepInclude(doc, {
          touched: 1,
          touched_by: "cscott",
          solved: null,
          solved_by: null,
          confirmed_by: null,
          tags: {},
        });
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, {
          status: "accepted",
          response: "Make us some supersaturated Kool-Aid",
          resolved: 7,
        });
      });

      it("does not oplog", async function () {
        const o = await Messages.find({
          room_name: "oplog/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 0);
      });

      it("notifies puzzle chat", async function () {
        const o = await Messages.find({
          room_name: `puzzles/${puzzle}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "ACCEPTED", "message");
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
      });

      it("notifies general chat", async function () {
        const o = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
      });
    });

    it("does not notify meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 0);
    });
  });

  describe("for message to HQ", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "message to hq",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin),
        Match.Error
      );
    });

    describe("when logged in", () =>
      describe("without response", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin));

        it("does not update puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 1,
            touched_by: "cscott",
            solved: null,
            solved_by: null,
            confirmed_by: null,
            tags: {},
          });
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 0);
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "ACCEPTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      }));

    describe("with response", function () {
      beforeEach(() =>
        callAs(
          "correctCallIn",
          "cjb",
          callin,
          "Make us some supersaturated Kool-Aid"
        )
      );

      it("does not update puzzle", async function () {
        const doc = await Puzzles.findOneAsync(puzzle);
        chai.assert.deepInclude(doc, {
          touched: 1,
          touched_by: "cscott",
          solved: null,
          solved_by: null,
          confirmed_by: null,
          tags: {},
        });
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, {
          status: "accepted",
          response: "Make us some supersaturated Kool-Aid",
          resolved: 7,
        });
      });

      it("does not oplog", async function () {
        const o = await Messages.find({
          room_name: "oplog/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 0);
      });

      it("notifies puzzle chat", async function () {
        const o = await Messages.find({
          room_name: `puzzles/${puzzle}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "ACCEPTED", "message");
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
      });

      it("notifies general chat", async function () {
        const o = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
      });
    });

    it("does not notify meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 0);
    });
  });

  describe("for expected callback", function () {
    beforeEach(async function () {
      puzzle = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        callin_type: "expected callback",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("correctCallIn", callin),
        Match.Error
      );
    });

    describe("when logged in", () =>
      describe("without response", function () {
        beforeEach(() => callAs("correctCallIn", "cjb", callin));

        it("does not update puzzle", async function () {
          const doc = await Puzzles.findOneAsync(puzzle);
          chai.assert.deepInclude(doc, {
            touched: 1,
            touched_by: "cscott",
            solved: null,
            solved_by: null,
            confirmed_by: null,
            tags: {},
          });
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "accepted",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          const o = await Messages.find({
            room_name: "oplog/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 0);
        });

        it("notifies puzzle chat", async function () {
          const o = await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "RECEIVED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
        });

        it("notifies general chat", async function () {
          const o = await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "RECEIVED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      }));

    describe("with response", function () {
      beforeEach(() =>
        callAs(
          "correctCallIn",
          "cjb",
          callin,
          "Make us some supersaturated Kool-Aid"
        )
      );

      it("does not update puzzle", async function () {
        const doc = await Puzzles.findOneAsync(puzzle);
        chai.assert.deepInclude(doc, {
          touched: 1,
          touched_by: "cscott",
          solved: null,
          solved_by: null,
          confirmed_by: null,
          tags: {},
        });
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, {
          status: "accepted",
          response: "Make us some supersaturated Kool-Aid",
          resolved: 7,
        });
      });

      it("does not oplog", async function () {
        const o = await Messages.find({
          room_name: "oplog/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 0);
      });

      it("notifies puzzle chat", async function () {
        const o = await Messages.find({
          room_name: `puzzles/${puzzle}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "RECEIVED", "message");
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.notInclude(o[0].body, `(#puzzles/${puzzle})`, "message");
      });

      it("notifies general chat", async function () {
        const o = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          nick: "cjb",
          action: true,
        });
        chai.assert.include(o[0].body, "RECEIVED", "message");
        chai.assert.include(o[0].body, '"precipitate"', "message");
        chai.assert.include(
          o[0].body,
          "Make us some supersaturated Kool-Aid",
          "message"
        );
        chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
      });
    });

    it("does not notify meta chat for puzzle", async function () {
      const meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        confirmed_by: null,
        tags: {},
        feedsInto: [],
        puzzles: [puzzle],
      });
      await Puzzles.updateAsync(puzzle, { $push: { feedsInto: meta } });
      await callAs("correctCallIn", "cjb", callin);
      const m = await Messages.find({
        room_name: `puzzles/${meta}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(m, 0);
    });
  });
});
