// For side effects
import "/lib/model.js";
import { Roles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import { clearCollections, waitForDeletion, waitForDocument } from "/lib/imports/testutils.js";
import { RoleManager } from "./roles.js";

describe("RoleManager", function () {
  let clock = null;
  let manager = null;

  beforeEach(async function () {
    await clearCollections(Roles);
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["setTimeout", "clearTimeout", "Date"],
    });
  });

  afterEach(function () {
    manager?.stop();
    clock.restore();
  });

  it("deletes expired immediately", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3600000,
      renewed_at: -3600000,
      expires_at: 0,
    });
    manager = new RoleManager();
    await manager.start();
    chai.assert.isNotOk(await Roles.findOneAsync("onduty"));
  });

  it("deletes expired after expiry", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000,
    });
    manager = new RoleManager();
    await manager.start();
    chai.assert.isOk(await Roles.findOneAsync("onduty"));
    const {deleted} = await waitForDeletion(Roles, "onduty");
    clock.tick(1000);
    await deleted;
  });

  it("extends deadline after update", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000,
    });
    manager = new RoleManager();
    await manager.start();
    chai.assert.isOk(await Roles.findOneAsync("onduty"));
    await Roles.updateAsync("onduty", {
      holder: "cjb",
      expires_at: 2000,
    });
    clock.tick(1000);
    // check not deleted?
    await waitForDocument(Roles, { _id: "onduty", expires_at: 2000 }, {});
    const {deleted} = await waitForDeletion(Roles, "onduty");
    clock.tick(1000);
    await deleted;
  });

  it("cancels timeout after removal", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: -3599000,
      renewed_at: -3599000,
      expires_at: 1000,
    });
    const {deleted} = await waitForDeletion(Roles, "onduty");
    manager = new RoleManager();
    await manager.start();
    chai.assert.isOk(await Roles.findOneAsync("onduty"));
    await Roles.removeAsync("onduty");
    await deleted;
    clock.tick(1000);
  });
});
