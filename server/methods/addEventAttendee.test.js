// For side effects
import "/lib/model.js";
import { CalendarEvents } from "/lib/imports/collections.js";
// Test only works on server side; move to /server if you add client tests.
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("addEventAttendee", function () {
  beforeEach(() => clearCollections(Meteor.users, CalendarEvents));

  it("fails without login", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    await assertRejects(
      Meteor.callAsync("addEventAttendee", "evt1", "cjb"),
      Match.Error
    );
  });

  it("fails when no such event", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    chai.assert.isFalse(await callAs("addEventAttendee", "cjb", "evt1", "cjb"));
  });

  it("fails when no such user", async function () {
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    await assertRejects(
      callAs("addEventAttendee", "cjb", "evt1", "cjb"),
      Match.Error
    );
  });

  it("adds attendee", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    chai.assert.isTrue(await callAs("addEventAttendee", "cjb", "evt1", "cjb"));
    chai.assert.deepInclude(
      await CalendarEvents.findOneAsync({ _id: "evt1" }),
      {
        attendees: ["cscott", "cjb"],
      }
    );
  });

  it("adds someone else", async function () {
    await Meteor.users.insertAsync({ _id: "bjc" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    chai.assert.isTrue(await callAs("addEventAttendee", "cjb", "evt1", "bjc"));
    chai.assert.deepInclude(
      await CalendarEvents.findOneAsync({ _id: "evt1" }),
      {
        attendees: ["cscott", "bjc"],
      }
    );
  });

  it("noop when already attending", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cjb", "cscott"],
    });
    chai.assert.isTrue(await callAs("addEventAttendee", "cjb", "evt1", "cjb"));
    chai.assert.deepInclude(
      await CalendarEvents.findOneAsync({ _id: "evt1" }),
      {
        attendees: ["cjb", "cscott"],
      }
    );
  });
});
