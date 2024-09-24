// For side effects
import "/lib/model.js";
import { Polls } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("vote", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Polls));

  it("fails without login", async function () {
    await Polls.insertAsync({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {},
    });
    await assertRejects(Meteor.callAsync("vote", "foo", "foo"), Match.Error);
  });

  it("fails with missing poll", async function () {
    await assertRejects(callAs("vote", "torgen", "", "foo"), Match.Error);
  });

  it("fails with missing option", async function () {
    await assertRejects(callAs("vote", "torgen", "foo"), Match.Error);
  });

  it("no-ops when no such poll", async function () {
    await callAs("vote", "torgen", "foo", "bar");
    chai.assert.notExists(await Polls.findOneAsync());
  });

  it("no-ops when no such option", async function () {
    await Polls.insertAsync({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    await callAs("vote", "torgen", "foo", "qux");
    chai.assert.deepEqual(await Polls.findOneAsync(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
  });

  it("adds vote", async function () {
    await Polls.insertAsync({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    await callAs("vote", "torgen", "foo", "bar");
    chai.assert.deepEqual(await Polls.findOneAsync(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {
        metasj: { canon: "foo", timestamp: 4 },
        torgen: { canon: "bar", timestamp: 7 },
      },
    });
  });

  it("changes vote", async function () {
    await Polls.insertAsync({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    await callAs("vote", "metasj", "foo", "bar");
    chai.assert.deepEqual(await Polls.findOneAsync(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {
        metasj: { canon: "bar", timestamp: 7 },
      },
    });
  });
});
