// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("summon", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages, Puzzles));

  it("fails without login", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "cjb",
      solved: 2,
      solved_by: "cjb",
      tags: {
        answer: {
          name: "Answer",
          value: "precipitate",
          touched: 2,
          touched_by: "cjb",
        },
      },
    });
    await assertRejects(
      Meteor.callAsync("summon", { object: id }),
      Match.Error
    );
  });

  it("fails when puzzle doesn't exist", async function () {
    chai.assert.isString(
      await callAs("summon", "torgen", { object: "never heard of it" })
    );
  });

  describe("when already answered", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "cjb",
        solved: 2,
        solved_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "precipitate",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("summon", "torgen", { object: id });
    });

    it("returns an error", () => chai.assert.isString(ret));

    it("doesn't touch", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 2,
        touched_by: "cjb",
        solved: 2,
        solved_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "precipitate",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
    });

    it("doesn't chat", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: { $ne: "oplog/0" } }).fetchAsync(),
        0
      );
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: "oplog/0" }).fetchAsync(),
        0
      );
    });
  });

  describe("when already stuck", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        tags: {
          status: {
            name: "Status",
            value: "Stuck on you",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("summon", "torgen", {
        object: id,
        how: "Stuck like glue",
      });
    });
    it("returns nothing", () => chai.assert.isUndefined(ret));

    it("updates document", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 7,
        touched_by: "torgen",
        tags: {
          status: {
            name: "Status",
            value: "Stuck like glue",
            touched: 7,
            touched_by: "torgen",
          },
        },
      });
    });

    it("doesn't chat", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: { $ne: "oplog/0" } }).fetchAsync(),
        0
      );
    });

    it("doesn't oplog", async function () {
      chai.assert.lengthOf(
        await Messages.find({ room_name: "oplog/0" }).fetchAsync(),
        0
      );
    });
  });

  describe("with other status", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        tags: {
          status: {
            name: "Status",
            value: "everything is fine",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("summon", "torgen", {
        object: id,
        how: "Stuck like glue",
      });
    });
    it("returns nothing", () => chai.assert.isUndefined(ret));

    it("updates document", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 7,
        touched_by: "torgen",
        tags: {
          status: {
            name: "Status",
            value: "Stuck like glue",
            touched: 7,
            touched_by: "torgen",
          },
        },
      });
    });

    it("notifies main chat", async function () {
      const msgs = await Messages.find({
        room_name: "general/0",
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ": Stuck like glue (");
      chai.assert.include(msgs[0].body, "Foo");
      chai.assert.notInclude(msgs[0].body, "solver-minutes");
    });

    it("notifies puzzle chat", async function () {
      const msgs = await Messages.find({
        room_name: `puzzles/${id}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ": Stuck like glue");
      chai.assert.notInclude(msgs[0].body, "Foo");
      chai.assert.notInclude(msgs[0].body, "solver-minutes");
    });

    it("oplogs", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          room_name: "oplog/0",
          stream: "stuck",
          type: "puzzles",
          id,
        }).fetchAsync(),
        1
      );
    });
  });

  describe("with no status", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("summon", { object: id }),
        Match.Error
      );
    });

    describe("empty how", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("summon", "torgen", { object: id });
      });

      it("returns nothing", () => chai.assert.isUndefined(ret));

      it("updates document", async function () {
        chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
          touched: 7,
          touched_by: "torgen",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 7,
              touched_by: "torgen",
            },
          },
        });
      });

      it("notifies main chat", async function () {
        const msgs = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": Stuck (");
        chai.assert.include(msgs[0].body, "Foo");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
      });

      it("notifies puzzle chat", async function () {
        const msgs = await Messages.find({
          room_name: `puzzles/${id}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": Stuck");
        chai.assert.notInclude(msgs[0].body, "Foo");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "oplog/0",
            stream: "stuck",
            type: "puzzles",
            id,
          }).fetchAsync(),
          1
        );
      });
    });

    describe("how starts with stuck", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("summon", "torgen", {
          object: id,
          how: "stucK like glue",
        });
      });

      it("returns nothing", () => chai.assert.isUndefined(ret));

      it("updates document", async function () {
        chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
          touched: 7,
          touched_by: "torgen",
          tags: {
            status: {
              name: "Status",
              value: "stucK like glue",
              touched: 7,
              touched_by: "torgen",
            },
          },
        });
      });

      it("notifies main chat", async function () {
        const msgs = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": stucK like glue (");
        chai.assert.include(msgs[0].body, "Foo");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
      });

      it("notifies puzzle chat", async function () {
        const msgs = await Messages.find({
          room_name: `puzzles/${id}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": stucK like glue");
        chai.assert.notInclude(msgs[0].body, "Foo");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "oplog/0",
            stream: "stuck",
            type: "puzzles",
            id,
          }).fetchAsync(),
          1
        );
      });
    });

    describe("how starts with other", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("summon", "torgen", {
          object: id,
          how: "no idea",
        });
      });

      it("returns nothing", () => chai.assert.isUndefined(ret));

      it("updates document", async function () {
        chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
          touched: 7,
          touched_by: "torgen",
          tags: {
            status: {
              name: "Status",
              value: "Stuck: no idea",
              touched: 7,
              touched_by: "torgen",
            },
          },
        });
      });

      it("notifies main chat", async function () {
        const msgs = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": no idea (");
        chai.assert.notInclude(msgs[0].body, "Stuck");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
        chai.assert.include(msgs[0].body, "Foo");
      });

      it("notifies puzzle chat", async function () {
        const msgs = await Messages.find({
          room_name: `puzzles/${id}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, ": no idea");
        chai.assert.notInclude(msgs[0].body, "Stuck");
        chai.assert.notInclude(msgs[0].body, "Foo");
        chai.assert.notInclude(msgs[0].body, "solver-minutes");
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "oplog/0",
            stream: "stuck",
            type: "puzzles",
            id,
          }).fetchAsync(),
          1
        );
      });
    });
  });

  describe("with solver time", function () {
    let id = null;
    let ret = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        solverTime: 1920004,
        tags: {
          status: {
            name: "Status",
            value: "everything is fine",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("summon", "torgen", {
        object: id,
        how: "Stuck like glue",
      });
    });
    it("returns nothing", () => chai.assert.isUndefined(ret));

    it("updates document", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 7,
        touched_by: "torgen",
        tags: {
          status: {
            name: "Status",
            value: "Stuck like glue",
            touched: 7,
            touched_by: "torgen",
          },
        },
      });
    });

    it("notifies main chat", async function () {
      const msgs = await Messages.find({
        room_name: "general/0",
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ": Stuck like glue (");
      chai.assert.include(msgs[0].body, "Foo");
      chai.assert.include(msgs[0].body, "32 solver-minutes");
    });

    it("notifies puzzle chat", async function () {
      const msgs = await Messages.find({
        room_name: `puzzles/${id}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, ": Stuck like glue");
      chai.assert.notInclude(msgs[0].body, "Foo");
      chai.assert.notInclude(msgs[0].body, "solver-minutes");
    });

    it("oplogs", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          room_name: "oplog/0",
          stream: "stuck",
          type: "puzzles",
          id,
        }).fetchAsync(),
        1
      );
    });
  });
});
