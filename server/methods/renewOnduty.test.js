// For side effects
import "/lib/model.js";
import { Roles } from "/lib/imports/collections.js";
import { callAs, impersonating } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { RoleRenewalTime } from "/lib/imports/settings.js";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("renewOnduty", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 70000,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(async function () {
    await clearCollections(Roles);
    await RoleRenewalTime.reset();
  });

  it("fails without login", async function () {
    await assertRejects(Meteor.callAsync("renewOnduty"), Match.Error);
  });

  it("renews your onduty", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isTrue(await callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 70000,
      expires_at: 3670000,
    });
  });

  it("uses renewal time", async function () {
    await impersonating("cjb", () => RoleRenewalTime.set(30));
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isTrue(await callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 70000,
      expires_at: 1870000,
    });
  });

  it("fails when nobody is onduty", async function () {
    chai.assert.isFalse(await callAs("renewOnduty", "torgen"));
    chai.assert.isNotOk(await Roles.findOneAsync("onduty"));
  });

  it("fails when somebody else is onduty", async function () {
    await Roles.insertAsync({
      _id: "onduty",
      holder: "cscott",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isFalse(await callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
      holder: "cscott",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
  });
});
