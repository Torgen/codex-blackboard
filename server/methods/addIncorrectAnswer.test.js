// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("addIncorrectAnswer", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it("fails when it doesn't exist", () =>
    chai.assert.throws(
      () =>
        callAs("addIncorrectAnswer", "torgen", {
          target: "something",
          answer: "precipitate",
        }),
      Meteor.Error
    ));

  describe("which exists", function () {
    let id = null;
    beforeEach(function () {
      id = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 2,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        tags: {
          status: {
            name: "Status",
            value: "stuck",
            touched: 2,
            touched_by: "torgen",
          },
        },
      });
      CallIns.insert({
        target_type: "puzzles",
        target: id,
        name: "Foo",
        answer: "flimflam",
        created: 4,
        created_by: "cjb",
        callin_type: "answer",
        status: "pending",
      });
    });

    it("fails without login", () =>
      chai.assert.throws(
        () =>
          Meteor.call("addIncorrectAnswer", {
            target: id,
            answer: "flimflam",
          }),
        Match.Error
      ));

    describe("when logged in", function () {
      beforeEach(() =>
        callAs("addIncorrectAnswer", "cjb", {
          target: id,
          answer: "flimflam",
        })
      );

      it("doesn't touch", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.include(doc, {
          touched: 2,
          touched_by: "torgen",
        });
      });

      it("oplogs", function () {
        const o = Messages.find({ room_name: "oplog/0" }).fetch();
        chai.assert.lengthOf(o, 1);
        chai.assert.include(o[0], {
          type: "puzzles",
          id,
          stream: "callins",
          nick: "cjb",
        });
        // oplog is lowercase
        chai.assert.include(o[0].body, "flimflam", "message");
      });

      it("updates callin", () =>
        chai.assert.include(CallIns.findOne(), { status: "rejected" }));
    });
  });
});
