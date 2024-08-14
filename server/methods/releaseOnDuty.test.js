// For side effects
import "/lib/model.js";
import { Messages, Roles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("releaseOnduty", function () {
  beforeEach(async function () {
    await clearCollections(Messages, Roles);
    await Roles.insertAsync({
      _id: "onduty",
      holder: "torgen",
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007,
    });
  });

  it("fails without login", async function () {
    await assertRejects(Meteor.callAsync("releaseOnduty"), Match.Error);
  });

  it("ends your onduty", async function () {
    chai.assert.isTrue(await callAs("releaseOnduty", "torgen"));
    chai.assert.isNotOk(await Roles.findOneAsync("onduty"));
    chai.assert.deepInclude(
      await Messages.findOneAsync({ room_name: "oplog/0" }),
      {
        nick: "torgen",
        id: null,
        type: "roles",
      }
    );
  });

  it("ignoses someone elses onduty", async function () {
    chai.assert.isFalse(await callAs("releaseOnduty", "cjb"));
    chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
      holder: "torgen",
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007,
    });
    chai.assert.isNotOk(await Messages.findOneAsync({ room_name: "oplog/0" }));
  });
});
