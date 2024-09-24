// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("unsummon", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages, Puzzles));

  it("fails when puzzle doesn't exist", async function () {
    chai.assert.isString(
      await callAs("unsummon", "torgen", { object: "never heard of it" })
    );
  });

  describe("which is not stuck", function () {
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
            value: "precipitate",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("unsummon", "torgen", { object: id });
    });

    it("returns an error", () => chai.assert.isString(ret));

    it("doesn't touch", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 2,
        touched_by: "cjb",
        tags: {
          status: {
            name: "Status",
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

  describe("which someone else made stuck", function () {
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
        tags: {
          status: {
            name: "Status",
            value: "stuck",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
    });

    it("fails without login", async function () {
      await assertRejects(
        Meteor.callAsync("unsummon", { object: id }),
        Match.Error
      );
    });

    return describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("unsummon", "torgen", { object: id });
      });

      it("returns nothing", () => chai.assert.isUndefined(ret));

      it("updates document", async function () {
        chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
          touched: 7,
          touched_by: "torgen",
          tags: {},
        });
      });

      it("oplogs", async function () {
        chai.assert.lengthOf(
          await Messages.find({
            room_name: "oplog/0",
            type: "puzzles",
            id,
          }).fetchAsync(),
          1
        );
      });

      it("notifies main chat", async function () {
        const msgs = await Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, "has arrived");
        chai.assert.include(msgs[0].body, "puzzle Foo");
      });

      it("notifies puzzle chat", async function () {
        const msgs = await Messages.find({
          room_name: `puzzles/${id}`,
          dawn_of_time: { $ne: true },
        }).fetchAsync();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, "has arrived");
        chai.assert.notInclude(msgs[0].body, "puzzle Foo");
      });
    });
  });

  return describe("which they made stuck", function () {
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
            value: "stuck",
            touched: 2,
            touched_by: "cjb",
          },
        },
      });
      ret = await callAs("unsummon", "cjb", { object: id });
    });

    it("returns nothing", () => chai.assert.isUndefined(ret));

    it("updates document", async function () {
      chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
        touched: 7,
        touched_by: "cjb",
        tags: {},
      });
    });

    it("oplogs", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          room_name: "oplog/0",
          type: "puzzles",
          id,
        }).fetchAsync(),
        1
      );
    });

    it("notifies main chat", async function () {
      const msgs = await Messages.find({
        room_name: "general/0",
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, "no longer");
      chai.assert.include(msgs[0].body, "puzzle Foo");
    });

    return it("notifies puzzle chat", async function () {
      const msgs = await Messages.find({
        room_name: `puzzles/${id}`,
        dawn_of_time: { $ne: true },
      }).fetchAsync();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, "no longer");
      chai.assert.notInclude(msgs[0].body, "puzzle Foo");
    });
  });
});
