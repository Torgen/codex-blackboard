// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("cancelCallIn", function () {
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

  let puzzle = null;
  let callin = null;
  beforeEach(function () {
    puzzle = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 1,
      touched_by: "cscott",
      solved: null,
      solved_by: null,
      tags: {},
    });
    callin = CallIns.insert({
      name: "Foo:precipitate",
      target: puzzle,
      answer: "precipitate",
      created: 2,
      created_by: "torgen",
      submitted_to_hq: true,
      backsolve: false,
      provided: false,
      status: "pending",
    });
  });

  it("fails when callin doesn't exist", function () {
    chai.assert.throws(
      () => callAs("cancelCallIn", "cjb", {id: "never heard of it"}),
      Meteor.Error
    );
  });

  it("fails without login", () =>
    chai.assert.throws(
      () => Meteor.call("cancelCallIn", { id: callin }),
      Match.Error
    ));

  describe("when logged in", function () {
    beforeEach(() => callAs("cancelCallIn", "cjb", { id: callin }));

    it("updates callin", function () {
      const c = CallIns.findOne();
      chai.assert.include(c, {
        status: "cancelled",
        resolved: 7,
      });
    });

    it("oplogs", () =>
      chai.assert.lengthOf(
        Messages.find({ type: "puzzles", id: puzzle }).fetch(),
        1
      ));
  });
});
