// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
// Test only works on server side; move to /server if you add client tests.
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("deleteAnswer", function () {
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
      tags: {
        status: {
          name: "Status",
          value: "stuck",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    chai.assert.throws(
      () => Meteor.call("deleteAnswer", { target: id }),
      Match.Error,
    );
  });

  it("works when unanswered", function () {
    const id = Puzzles.insert({
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
    callAs("deleteAnswer", "cjb", { target: id });
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
    const oplogs = Messages.find({ room_name: "oplog/0" }).fetch();
    chai.assert.equal(oplogs.length, 1);
    chai.assert.include(oplogs[0], {
      nick: "cjb",
      timestamp: 7,
      body: "Deleted answer for",
      bodyIsHtml: false,
      type: "puzzles",
      id,
      oplog: true,
      followup: true,
      action: true,
      system: false,
      to: null,
      stream: "",
    });
  });

  it("removes answer", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: 2,
      solved_by: "cjb",
      confirmed_by: "torgen",
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
    callAs("deleteAnswer", "cjb", { target: id });
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
      confirmed_by: null,
      tags: {
        temperature: {
          name: "Temperature",
          value: "12",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    const oplogs = Messages.find({ room_name: "oplog/0" }).fetch();
    chai.assert.equal(oplogs.length, 1);
    chai.assert.include(oplogs[0], {
      nick: "cjb",
      timestamp: 7,
      body: "Deleted answer for",
      bodyIsHtml: false,
      type: "puzzles",
      id,
      oplog: true,
      followup: true,
      action: true,
      system: false,
      to: null,
      stream: "",
    });
  });

  it("removes backsolve and provided", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "cscott",
      touched: 2,
      touched_by: "torgen",
      solved: 2,
      solved_by: "cjb",
      confirmed_by: "torgen",
      tags: {
        answer: {
          name: "Answer",
          value: "foo",
          touched: 2,
          touched_by: "torgen",
        },
        backsolve: {
          name: "Backsolve",
          value: "yes",
          touched: 2,
          touched_by: "torgen",
        },
        provided: {
          name: "Provided",
          value: "yes",
          touched: 2,
          touched_by: "torgen",
        },
      },
    });
    callAs("deleteAnswer", "cjb", { target: id });
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
      confirmed_by: null,
      tags: {},
    });
    const oplogs = Messages.find({ room_name: "oplog/0" }).fetch();
    chai.assert.equal(oplogs.length, 1);
    chai.assert.include(oplogs[0], {
      nick: "cjb",
      timestamp: 7,
      body: "Deleted answer for",
      bodyIsHtml: false,
      type: "puzzles",
      id,
      oplog: true,
      followup: true,
      action: true,
      system: false,
      to: null,
      stream: "",
    });
  });
});
