// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("makeNotMeta", function () {
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

  it("fails without login", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      puzzles: [],
      tags: {
        status: {
          name: "Status",
          value: "stuck",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    chai.assert.throws(() => Meteor.call("makeNotMeta", id), Match.Error);
  });

  it("works when empty", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      puzzles: [],
      tags: {
        status: {
          name: "Status",
          value: "stuck",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    chai.assert.isTrue(callAs("makeNotMeta", "cjb", id));
    const doc = Puzzles.findOne(id);
    chai.assert.deepEqual(doc, {
      _id: id,
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 7,
      touched_by: "cjb",
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
  });

  it("fails when not empty", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: 2,
      solved_by: "torgen",
      puzzles: ["bar"],
      tags: {
        answer: {
          name: "Answer",
          value: "foo",
          touched: 2,
          touched_by: "torgen",
        },
        temperature: {
          name: "Temperature",
          value: "12",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    chai.assert.isFalse(callAs("makeNotMeta", "cjb", id));
    const doc = Puzzles.findOne(id);
    chai.assert.deepEqual(doc, {
      _id: id,
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      puzzles: ["bar"],
      solved: 2,
      solved_by: "torgen",
      tags: {
        answer: {
          name: "Answer",
          value: "foo",
          touched: 2,
          touched_by: "torgen",
        },
        temperature: {
          name: "Temperature",
          value: "12",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
  });
});
