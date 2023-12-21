// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("unsummon", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      })),
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  describe("which is not stuck", function () {
    let id = null;
    let ret = null;
    beforeEach(function () {
      id = Puzzles.insert({
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
      ret = callAs("unsummon", "torgen", { object: id });
    });

    it("returns an error", () => chai.assert.isString(ret));

    it("doesn't touch", () =>
      chai.assert.deepInclude(Puzzles.findOne(id), {
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
      }));

    it("doesn't chat", () =>
      chai.assert.lengthOf(
        Messages.find({ room_name: { $ne: "oplog/0" } }).fetch(),
        0,
      ));

    it("doesn't oplog", () =>
      chai.assert.lengthOf(Messages.find({ room_name: "oplog/0" }).fetch(), 0));
  });

  describe("which someone else made stuck", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
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
        })),
    );

    it("fails without login", () =>
      chai.assert.throws(
        () => Meteor.call("unsummon", { object: id }),
        Match.Error,
      ));

    return describe("when logged in", function () {
      let ret = null;
      beforeEach(() => (ret = callAs("unsummon", "torgen", { object: id })));

      it("returns nothing", () => chai.assert.isUndefined(ret));

      it("updates document", () =>
        chai.assert.deepInclude(Puzzles.findOne(id), {
          touched: 7,
          touched_by: "torgen",
          tags: {},
        }));

      it("oplogs", () =>
        chai.assert.lengthOf(
          Messages.find({ room_name: "oplog/0", type: "puzzles", id }).fetch(),
          1,
        ));

      it("notifies main chat", function () {
        const msgs = Messages.find({
          room_name: "general/0",
          dawn_of_time: { $ne: true },
        }).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, "has arrived");
        return chai.assert.include(msgs[0].body, "puzzle Foo");
      });

      return it("notifies puzzle chat", function () {
        const msgs = Messages.find({
          room_name: `puzzles/${id}`,
          dawn_of_time: { $ne: true },
        }).fetch();
        chai.assert.lengthOf(msgs, 1);
        chai.assert.include(msgs[0].body, "has arrived");
        return chai.assert.notInclude(msgs[0].body, "puzzle Foo");
      });
    });
  });

  return describe("which they made stuck", function () {
    let id = null;
    let ret = null;
    beforeEach(function () {
      id = Puzzles.insert({
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
      return (ret = callAs("unsummon", "cjb", { object: id }));
    });

    it("returns nothing", () => chai.assert.isUndefined(ret));

    it("updates document", () =>
      chai.assert.deepInclude(Puzzles.findOne(id), {
        touched: 7,
        touched_by: "cjb",
        tags: {},
      }));

    it("oplogs", () =>
      chai.assert.lengthOf(
        Messages.find({ room_name: "oplog/0", type: "puzzles", id }).fetch(),
        1,
      ));

    it("notifies main chat", function () {
      const msgs = Messages.find({
        room_name: "general/0",
        dawn_of_time: { $ne: true },
      }).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, "no longer");
      return chai.assert.include(msgs[0].body, "puzzle Foo");
    });

    return it("notifies puzzle chat", function () {
      const msgs = Messages.find({
        room_name: `puzzles/${id}`,
        dawn_of_time: { $ne: true },
      }).fetch();
      chai.assert.lengthOf(msgs, 1);
      chai.assert.include(msgs[0].body, "no longer");
      return chai.assert.notInclude(msgs[0].body, "puzzle Foo");
    });
  });
});
