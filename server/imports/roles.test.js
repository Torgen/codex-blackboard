// For side effects
import "/lib/model.js";
import { Roles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import { waitForDeletion, waitForDocument } from "/lib/imports/testutils.js";
import { RoleManager } from "./roles.js";

describe("RoleManager", function () {
  let clock = null;
  let manager = null;

  beforeEach(function () {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setTimeout", "clearTimeout", "Date"]
    });
  });

  afterEach(function () {
    manager?.stop();
    clock.restore();
  });

  it("deletes expired immediately", function () {
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3600000,
      renewed_at: -3600000,
      expires_at: 0
    });
    manager = new RoleManager();
    manager.start();
    chai.assert.isNotOk(Roles.findOne("onduty"));
  });

  it("deletes expired after expiry", async function () {
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000
    });
    manager = new RoleManager();
    manager.start();
    chai.assert.isOk(Roles.findOne("onduty"));
    const p = waitForDeletion(Roles, "onduty");
    clock.tick(1000);
    await p;
  });

  it("extends deadline after update", async function () {
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000
    });
    manager = new RoleManager();
    manager.start();
    chai.assert.isOk(Roles.findOne("onduty"));
    Roles.update("onduty", {
      holder: "cjb",
      expires_at: 2000
    });
    clock.tick(1000);
    // check not deleted?
    await waitForDocument(Roles, { _id: "onduty", expires_at: 2000 }, {});
    const p = waitForDeletion(Roles, "onduty");
    clock.tick(1000);
    await p;
  });

  return it("cancels timeout after removal", async function () {
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000
    });
    const p = waitForDeletion(Roles, "onduty");
    manager = new RoleManager();
    manager.start();
    chai.assert.isOk(Roles.findOne("onduty"));
    Roles.remove("onduty");
    await p;
    clock.tick(1000);
  });
});
