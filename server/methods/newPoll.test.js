// For side effects
import "/lib/model.js";
import { Messages, Polls } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("newPoll", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages, Polls));

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("newPoll", "general/0", "What up?", [
        "Sky",
        "Ceiling",
        "Aliens",
      ]),
      Match.Error
    );
  });

  it("fails with no options", async function () {
    await assertRejects(
      callAs("newPoll", "torgen", "general/0", "What up?", []),
      Match.Error
    );
  });

  it("fails with one option", async function () {
    await assertRejects(
      callAs("newPoll", "torgen", "general/0", "What up?", ["everything"]),
      Match.Error
    );
  });

  it("fails with six options", async function () {
    await assertRejects(
      callAs("newPoll", "torgen", "general/0", "What up?", [
        "Red",
        "Orange",
        "Yellow",
        "Green",
        "Blue",
        "Purple",
      ]),
      Match.Error
    );
  });

  it("fails with no room", async function () {
    await assertRejects(
      callAs("newPoll", "torgen", "", "What up?", ["Sky", "Ceiling", "Aliens"]),
      Match.Error
    );
  });

  it("fails with no question", async function () {
    await assertRejects(
      callAs("newPoll", "torgen", "general/0", "", [
        "Sky",
        "Ceiling",
        "Aliens",
      ]),
      Match.Error
    );
  });

  it("canonicalizes options", async function () {
    await callAs("newPoll", "torgen", "general/0", "What up?", [
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "red",
    ]);
    chai.assert.deepInclude(await Polls.findOneAsync(), {
      created: 7,
      created_by: "torgen",
      question: "What up?",
      options: [
        { canon: "red", option: "Red" },
        { canon: "orange", option: "Orange" },
        { canon: "yellow", option: "Yellow" },
        { canon: "green", option: "Green" },
      ],
      votes: {},
    });
  });

  it("creates message", async function () {
    await callAs("newPoll", "torgen", "general/0", "What up?", [
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "Blue",
    ]);
    const p = (await Polls.findOneAsync())._id;
    chai.assert.deepInclude(
      await Messages.findOneAsync({ dawn_of_time: { $ne: true } }),
      {
        room_name: "general/0",
        nick: "torgen",
        body: "What up?",
        timestamp: 7,
        poll: p,
      }
    );
  });
});
