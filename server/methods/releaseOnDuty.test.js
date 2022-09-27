// For side effects
import "/lib/model.js";
import { Messages, Roles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("releaseOnduty", function () {
  beforeEach(function () {
    resetDatabase();
    Roles.insert({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007,
    });
  });

  it("fails without login", () =>
    chai.assert.throws(() => Meteor.call("releaseOnduty"), Match.Error));

  it("ends your onduty", function () {
    chai.assert.isTrue(callAs("releaseOnduty", "torgen"));
    chai.assert.isNotOk(Roles.findOne("onduty"));
    chai.assert.deepInclude(Messages.findOne({ room_name: "oplog/0" }), {
      nick: "torgen",
      id: null,
      type: "roles",
    });
  });

  it("ignoses someone elses onduty", function () {
    chai.assert.isFalse(callAs("releaseOnduty", "cjb"));
    chai.assert.deepInclude(Roles.findOne("onduty"), {
      holder: "torgen",
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007,
    });
    chai.assert.isNotOk(Messages.findOne({ room_name: "oplog/0" }));
  });
});
