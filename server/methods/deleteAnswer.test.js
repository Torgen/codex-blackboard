// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
// Test only works on server side; move to /server if you add client tests.
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("deleteAnswer", function () {
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
    await assertRejects(
      Meteor.callAsync("deleteAnswer", { target: id }),
      Match.Error
    );
  });

  it("works when unanswered", async function () {
    const id = await Puzzles.insertAsync({
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
    await callAs("deleteAnswer", "cjb", { target: id });
    const doc = await Puzzles.findOneAsync(id);
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
    const oplogs = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
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

  it("removes answer", async function () {
    const id = await Puzzles.insertAsync({
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
    await callAs("deleteAnswer", "cjb", { target: id });
    const doc = await Puzzles.findOneAsync(id);
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
    const oplogs = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
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

  it("removes backsolve and provided", async function () {
    const id = await Puzzles.insertAsync({
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
    await callAs("deleteAnswer", "cjb", { target: id });
    const doc = await Puzzles.findOneAsync(id);
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
    const oplogs = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
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
