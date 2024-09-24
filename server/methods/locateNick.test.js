// For side effects
import "./locateNick.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("locateNick", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Meteor.users));

  it("fails without login", async function () {
    await assertRejects(
      Meteor.callAsync("locateNick", {
        location: {
          type: "Point",
          coordinates: [-122.036346, 37.368832],
        },
        timestamp: 5,
      }),
      Match.Error
    );
  });

  it("fails with old params", async function () {
    await assertRejects(
      callAs("locateNick", "torgen", {
        lat: 37.368832,
        lng: -122.036346,
        timestamp: 5,
      }),
      Match.Error
    );
  });

  it("fails with non-point", async function () {
    await assertRejects(
      callAs("locateNick", "torgen", {
        location: {
          type: "LineString",
          coordinates: [
            [-122.036346, 37.368832],
            [-122.078827, 37.419857],
          ],
        },
        timestamp: 5,
      }),
      Match.Error
    );
  });

  describe("without queue position", function () {
    let id = null;
    beforeEach(async function () {
      id = await Meteor.users.insertAsync({
        _id: "torgen",
        located_at: {
          // Mountain View, CA
          type: "Point",
          coordinates: [-122.078827, 37.419857],
        },
      });

      await callAs("locateNick", "torgen", {
        location: {
          // Sunnyvale, CA
          type: "Point",
          coordinates: [-122.036346, 37.368832],
        },
        timestamp: 5,
      });
    });

    it("leaves public location", async function () {
      chai.assert.deepInclude(await Meteor.users.findOneAsync(id), {
        located_at: {
          type: "Point",
          coordinates: [-122.078827, 37.419857],
        },
      });
    });

    it("sets private location fields", async function () {
      chai.assert.deepInclude(await Meteor.users.findOneAsync(id), {
        priv_located: 5,
        priv_located_at: {
          type: "Point",
          coordinates: [-122.036346, 37.368832],
        },
        priv_located_order: 7,
      });
    });
  });

  it("leaves existing queue position", async function () {
    const id = await Meteor.users.insertAsync({
      _id: "torgen",
      located_at: {
        // Mountain View, CA
        type: "Point",
        coordinates: [-122.078827, 37.419857],
      },
      priv_located_order: 4,
    });

    await callAs("locateNick", "torgen", {
      location: {
        // Sunnyvale, CA
        type: "Point",
        coordinates: [-122.036346, 37.368832],
      },
    });

    chai.assert.deepInclude(await Meteor.users.findOneAsync(id), {
      priv_located: 7,
      priv_located_order: 4,
    });
  });
});
