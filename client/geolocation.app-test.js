import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  promiseCall,
  login,
  logout
} from "./imports/app_test_helpers.js";
import chai from "chai";
import { waitForDocument } from "/lib/imports/testutils.js";

const KRESGE = {
  type: "Point",
  coordinates: [-71.0972017, 42.3581396]
};

describe("geolocation", function () {
  this.timeout(10000);
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  return it("moves private location to public", async function () {
    const me = Meteor.user();
    chai.assert.isNotOk(me.located_at);
    chai.assert.isNotOk(me.priv_located_at);
    await promiseCall("locateNick", { location: KRESGE });
    chai.assert.deepEqual(Meteor.user().priv_located_at, KRESGE);
    return waitForDocument(
      Meteor.users,
      { _id: "testy", located: { $ne: null } },
      { located_at: KRESGE }
    );
  });
});
