// For side effetcs
import "/lib/model.js";
import { Messages, Roles } from "/lib/imports/collections.js";
import { callAs, impersonating } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { RoleRenewalTime } from "/lib/imports/settings.js";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("claimOnduty", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(async function () {
    await clearCollections(Messages, Roles);
    await RoleRenewalTime.reset();
  });

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("claimOnduty", { from: "cjb" }),
      Match.Error
    );
  });

  describe("when nobody is onduty", function () {
    it("claims onduty from nobody", async function () {
      await callAs("claimOnduty", "torgen", { from: null });
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "is now",
      });
    });

    it("claims onduty from anybody", async function () {
      await callAs("claimOnduty", "torgen", { from: "cscott" });
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "is now",
      });
    });

    it("uses setting for renewal time", async function () {
      await impersonating("cjb", () => RoleRenewalTime.set(30));
      await callAs("claimOnduty", "torgen", { from: "cscott" });
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 1800007,
      });
    });
  });

  describe("when somebody is onduty", function () {
    beforeEach(() =>
      Roles.insertAsync({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      })
    );

    it("claims onduty from them", async function () {
      await callAs("claimOnduty", "torgen", { from: "cjb" });
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = await Messages.find({ room_name: "oplog/0" }).fetchAsync();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "took over from @cjb as",
      });
    });

    it("fails to claim onduty from somebody else", async function () {
      await assertRejects(
        callAs("claimOnduty", "torgen", { from: "cscott" }),
        Meteor.Error,
        /412/
      );
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      });
    });

    it("fails to claim onduty from nobody", async function () {
      await assertRejects(
        callAs("claimOnduty", "torgen", { from: null }),
        Meteor.Error,
        /412/
      );
      chai.assert.deepInclude(await Roles.findOneAsync("onduty"), {
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      });
    });
  });
});
