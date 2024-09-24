// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles, Roles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils";
import { RoleRenewalTime } from "/lib/imports/settings.js";

describe("incorrectCallIn", function () {
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
    await assertRejects(
      callAs("incorrectCallIn", "cjb", "never heard of it"),
      Meteor.Error
    );
  });

  describe("on answer", function () {
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
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "answer",
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
        Meteor.callAsync("incorrectCallIn", callin),
        Match.Error
      );
    });

    describe("when logged in", function () {
      beforeEach(async function () {
        await callAs("incorrectCallIn", "cjb", callin);
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, { status: "rejected" }, { resolved: 7 });
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            type: "puzzles",
            id: puzzle,
            stream: "callins",
          }).fetchAsync(),
          1
        );
      });

      it("notifies puzzle chat", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync(),
          1
        );
      });

      it("notifies general chat", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync(),
          1
        );
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
      beforeEach(async function () {
        await callAs("incorrectCallIn", "cscott", callin);
      });

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });
  });

  describe("on partial answer", function () {
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
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "partial answer",
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
        Meteor.callAsync("incorrectCallIn", callin),
        Match.Error
      );
    });

    describe("when logged in", function () {
      beforeEach(async function () {
        await callAs("incorrectCallIn", "cjb", callin);
      });

      it("updates callin", async function () {
        const c = await CallIns.findOneAsync(callin);
        chai.assert.include(c, { status: "rejected" }, { resolved: 7 });
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            type: "puzzles",
            id: puzzle,
            stream: "callins",
          }).fetchAsync(),
          1
        );
      });

      it("notifies puzzle chat", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetchAsync(),
          1
        );
      });

      it("notifies general chat", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetchAsync(),
          1
        );
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
      beforeEach(async function () {
        await callAs("incorrectCallIn", "cscott", callin);
      });

      it("leaves onduty alone", async function () {
        chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        });
      });
    });
  });

  describe("on interaction request", function () {
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
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "interaction request",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin),
          Match.Error
        );
      });

      describe("when logged in", function () {
        beforeEach(async function () {
          await callAs("incorrectCallIn", "cjb", callin);
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "rejected",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          chai.assert.lengthOf(
            await Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetchAsync(),
            0
          );
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
          chai.assert.include(o[0].body, "REJECTED", "message");
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      });
    });

    describe("with response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin, "sediment"),
          Match.Error
        );
      });

      describe("when logged in", function () {
        beforeEach(async function () {
          await callAs("incorrectCallIn", "cjb", callin, "sediment");
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "rejected",
            response: "sediment",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          chai.assert.lengthOf(
            await Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetchAsync(),
            0
          );
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      });
    });
  });

  describe("on message to hq", function () {
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
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "message to hq",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin),
          Match.Error
        );
      });

      describe("when logged in", function () {
        beforeEach(async function () {
          await callAs("incorrectCallIn", "cjb", callin);
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "rejected",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          chai.assert.lengthOf(
            await Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetchAsync(),
            0
          );
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
          chai.assert.include(o[0].body, "REJECTED", "message");
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      });
    });

    describe("with response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin, "sediment"),
          Match.Error
        );
      });

      describe("when logged in", function () {
        beforeEach(async function () {
          await callAs("incorrectCallIn", "cjb", callin, "sediment");
        });

        it("updates callin", async function () {
          const c = await CallIns.findOneAsync(callin);
          chai.assert.include(c, {
            status: "rejected",
            response: "sediment",
            resolved: 7,
          });
        });

        it("does not oplog", async function () {
          chai.assert.lengthOf(
            await Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetchAsync(),
            0
          );
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
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
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.include(o[0].body, `(#puzzles/${puzzle})`, "message");
        });
      });
    });
  });

  describe("on expected callback", function () {
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
        tags: {},
        feedsInto: [],
      });
      callin = await CallIns.insertAsync({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "expected callback",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin),
          Match.Error
        );
      });

      it("fails when logged in", async function () {
        await assertRejects(
          callAs("incorrectCallIn", "cjb", callin),
          Meteor.Error
        );
      });
    });

    describe("with response", function () {
      it("fails without login", async function () {
        await assertRejects(
          Meteor.callAsync("incorrectCallIn", callin, "sediment"),
          Match.Error
        );
      });

      it("fails when logged in", async function () {
        await assertRejects(
          callAs("incorrectCallIn", "cjb", callin, "sediment"),
          Meteor.Error
        );
      });
    });
  });
});
