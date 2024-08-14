// For side effects
import "/lib/model.js";
import { LastRead } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("updatelastRead", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(LastRead));

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("updateLastRead", {
        room_name: "general/0",
        timestamp: 3,
      }),
      Match.Error
    );
  });

  it("creates", async function () {
    await callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 3,
    });
    chai.assert.include(
      await LastRead.findOneAsync({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });

  it("advances", async function () {
    await LastRead.insertAsync({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 2,
    });
    await callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 3,
    });
    chai.assert.include(
      await LastRead.findOneAsync({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });

  it("doesn't retreat", async function () {
    await LastRead.insertAsync({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 3,
    });
    await callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 2,
    });
    chai.assert.include(
      await LastRead.findOneAsync({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });
});
