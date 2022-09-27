// For side effects
import "/lib/model.js";
import { Roles } from "/lib/imports/collections.js";
import { callAs, impersonating } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import { RoleRenewalTime } from "/lib/imports/settings.js";

describe("renewOnduty", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 70000,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(function () {
    resetDatabase();
    RoleRenewalTime.ensure();
  });

  it("fails without login", () =>
    chai.assert.throws(() => Meteor.call("renewOnduty"), Match.Error));

  it("renews your onduty", function () {
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isTrue(callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(Roles.findOne("onduty"), {
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 70000,
      expires_at: 3670000,
    });
  });

  it("uses renewal time", function () {
    impersonating("cjb", () => RoleRenewalTime.set(30));
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isTrue(callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(Roles.findOne("onduty"), {
      holder: "torgen",
      claimed_at: 10,
      renewed_at: 70000,
      expires_at: 1870000,
    });
  });

  it("fails when nobody is onduty", function () {
    chai.assert.isFalse(callAs("renewOnduty", "torgen"));
    chai.assert.isNotOk(Roles.findOne("onduty"));
  });

  it("fails when somebody else is onduty", function () {
    Roles.insert({
      _id: "onduty",
      holder: "cscott",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
    chai.assert.isFalse(callAs("renewOnduty", "torgen"));
    chai.assert.deepInclude(Roles.findOne("onduty"), {
      holder: "cscott",
      claimed_at: 10,
      renewed_at: 10,
      expires_at: 3600010,
    });
  });
});
