// For side effects
import "/lib/model.js";
import {
  CallIns,
  Messages,
  Presence,
  Puzzles,
} from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("setAnswer", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(CallIns, Messages, Presence, Puzzles));

  describe("without answer", function () {
    let id = null;
    let ret = null;
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
        confirmed_by: null,
        solverTime: 14,
        tags: {
          technology: {
            name: "Technology",
            value: "Pottery",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "torgen",
        timestamp: 2,
        scope: "chat",
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "botto",
        timestamp: 0,
        bot: true,
        scope: "chat",
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "idle",
        timestamp: -130001,
        scope: "chat",
      });
    });
    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("setAnswer", {
          target: id,
          answer: "bar",
        }),
        Match.Error
      );
    });

    describe("when logged in", function () {
      ret = null;
      beforeEach(async function () {
        ret = await callAs("setAnswer", "cjb", {
          target: id,
          answer: "bar",
        });
      });

      it("returns true", function () {
        chai.assert.isTrue(ret);
      });

      it("modifies document", async function () {
        chai.assert.deepEqual(await Puzzles.findOneAsync(id), {
          _id: id,
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "cscott",
          touched: 7,
          touched_by: "cjb",
          solved: 7,
          solved_by: "cjb",
          confirmed_by: "cjb",
          solverTime: 70027,
          tags: {
            answer: {
              name: "Answer",
              value: "bar",
              touched: 7,
              touched_by: "cjb",
            },
            technology: {
              name: "Technology",
              value: "Pottery",
              touched: 2,
              touched_by: "torgen",
            },
          },
        });
      });

      it("oplogs", async function () {
        const oplogs = await Messages.find({
          room_name: "oplog/0",
        }).fetchAsync();
        chai.assert.equal(oplogs.length, 1);
        chai.assert.include(oplogs[0], {
          nick: "cjb",
          timestamp: 7,
          type: "puzzles",
          id,
          oplog: true,
          action: true,
          stream: "answers",
        });
      });
    });
  });

  describe("with answer", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "torgen",
        solved: 2,
        solved_by: "cscott",
        confirmed_by: "torgen",
        solverTime: 0,
        tags: {
          answer: {
            name: "Answer",
            value: "qux",
            touched: 2,
            touched_by: "torgen",
          },
          technology: {
            name: "Technology",
            value: "Pottery",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
      ret = await callAs("setAnswer", "cjb", {
        target: id,
        answer: "bar",
      });
    });

    it("returns true", () => chai.assert.isTrue(ret));

    it("modifies document", async function () {
      chai.assert.deepEqual(await Puzzles.findOneAsync(id), {
        _id: id,
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 7,
        touched_by: "cjb",
        solved: 7,
        solved_by: "cjb",
        confirmed_by: "cjb",
        solverTime: 0,
        tags: {
          answer: {
            name: "Answer",
            value: "bar",
            touched: 7,
            touched_by: "cjb",
          },
          technology: {
            name: "Technology",
            value: "Pottery",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
    });

    it("oplogs", async function () {
      const oplogs = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
      chai.assert.equal(oplogs.length, 1);
      chai.assert.include(oplogs[0], {
        nick: "cjb",
        timestamp: 7,
        bodyIsHtml: false,
        type: "puzzles",
        id,
        oplog: true,
        action: true,
        stream: "answers",
      });
    });
  });

  describe("with same answer", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "torgen",
        solved: 2,
        solved_by: "cscott",
        confirmed_by: "torgen",
        solverTime: 14,
        tags: {
          answer: {
            name: "Answer",
            value: "bar",
            touched: 2,
            touched_by: "torgen",
          },
          technology: {
            name: "Technology",
            value: "Pottery",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "torgen",
        timestamp: 2,
        present: true,
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "botto",
        timestamp: 0,
        bot: true,
        scope: "chat",
      });
      await Presence.insertAsync({
        room_name: `puzzles/${id}`,
        nick: "idle",
        timestamp: -130001,
        scope: "chat",
      });
      ret = await callAs("setAnswer", "cjb", {
        target: id,
        answer: "bar",
      });
    });

    it("returns false", () => chai.assert.isFalse(ret));

    it("leaves document alone", async function () {
      chai.assert.deepEqual(await Puzzles.findOneAsync(id), {
        _id: id,
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "torgen",
        solved: 2,
        solved_by: "cscott",
        confirmed_by: "torgen",
        solverTime: 14,
        tags: {
          answer: {
            name: "Answer",
            value: "bar",
            touched: 2,
            touched_by: "torgen",
          },
          technology: {
            name: "Technology",
            value: "Pottery",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: "oplog/0" }).fetchAsync(),
        0
      );
    });
  });

  it("modifies tags", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      confirmed_by: null,
      tags: {
        status: {
          name: "Status",
          value: "stuck",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    chai.assert.isTrue(
      await callAs("setAnswer", "cjb", {
        target: id,
        answer: "bar",
        backsolve: true,
        provided: true,
      })
    );
    chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
      tags: {
        answer: { name: "Answer", value: "bar", touched: 7, touched_by: "cjb" },
        backsolve: {
          name: "Backsolve",
          value: "yes",
          touched: 7,
          touched_by: "cjb",
        },
        provided: {
          name: "Provided",
          value: "yes",
          touched: 7,
          touched_by: "cjb",
        },
      },
    });
  });

  describe("with matching callins", function () {
    let id = null;
    let cid1 = null;
    let cid2 = null;
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
        confirmed_by: null,
        tags: {},
      });
      cid1 = await CallIns.insertAsync({
        target_type: "puzzles",
        target: id,
        name: "Foo",
        answer: "bar",
        callin_type: "answer",
        created: 5,
        created_by: "codexbot",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      cid2 = await CallIns.insertAsync({
        target_type: "puzzles",
        target: id,
        name: "Foo",
        answer: "qux",
        callin_type: "answer",
        created: 5,
        created_by: "codexbot",
        submitted_to_hq: false,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      await callAs("setAnswer", "cjb", {
        target: id,
        answer: "bar",
      });
    });

    it("updates callins", async function () {
      chai.assert.include(await CallIns.findOneAsync(cid1), {
        status: "accepted",
        resolved: 7,
      });
      chai.assert.include(await CallIns.findOneAsync(cid2), {
        status: "cancelled",
        resolved: 7,
      });
    });

    it("doesn't oplog for callins", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          room_name: "oplog/0",
          type: "callins",
        }).fetchAsync(),
        0
      );
    });

    it("oplogs for puzzle", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          room_name: "oplog/0",
          type: "puzzles",
          id,
        }).fetchAsync(),
        1
      );
    });

    it("sets solved_by correctly", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        solved: 7,
        solved_by: "codexbot",
        confirmed_by: "cjb",
      });
    });
  });
});
