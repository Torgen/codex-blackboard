// For side effects
import "/lib/model.js";
import { LastRead } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("updatelastRead", function () {
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

  it("fails without login", () =>
    chai.assert.throws(
      () =>
        Meteor.call("updateLastRead", {
          room_name: "general/0",
          timestamp: 3,
        }),
      Match.Error
    ));

  it("creates", function () {
    callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 3,
    });
    chai.assert.include(
      LastRead.findOne({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });

  it("advances", function () {
    LastRead.insert({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 2,
    });
    callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 3,
    });
    chai.assert.include(
      LastRead.findOne({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });

  it("doesn't retreat", function () {
    LastRead.insert({
      nick: "torgen",
      room_name: "general/0",
      timestamp: 3,
    });
    callAs("updateLastRead", "torgen", {
      room_name: "general/0",
      timestamp: 2,
    });
    chai.assert.include(
      LastRead.findOne({ nick: "torgen", room_name: "general/0" }),
      { timestamp: 3 }
    );
  });
});
