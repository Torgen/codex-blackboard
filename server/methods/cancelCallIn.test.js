// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("cancelCallIn", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(CallIns, Messages, Puzzles));

  let puzzle = null;
  let callin = null;
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
    });
    callin = await CallIns.insertAsync({
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

  it("fails when callin doesn't exist", async function () {
    await assertRejects(
      callAs("cancelCallIn", "cjb", { id: "never heard of it" }),
      Meteor.Error
    );
  });

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("cancelCallIn", { id: callin }),
      Match.Error
    );
  });

  describe("when logged in", function () {
    beforeEach(() => callAs("cancelCallIn", "cjb", { id: callin }));

    it("updates callin", async function () {
      const c = await CallIns.findOneAsync();
      chai.assert.include(c, {
        status: "cancelled",
        resolved: 7,
      });
    });

    it("oplogs", async function () {
      chai.assert.lengthOf(
        await Messages.find({ type: "puzzles", id: puzzle }).fetchAsync(),
        1
      );
    });
  });
});
