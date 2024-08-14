// For side effects
import "/lib/model.js";
import { CalendarEvents } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("removeEventAttendee", function () {
  beforeEach(() => clearCollections(CalendarEvents, Meteor.users));

  it("fails without login", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cjb", "cscott"],
    });
    await assertRejects(
      Meteor.callAsync("removeEventAttendee", "evt1", "cjb"),
      Match.Error
    );
  });

  it("fails when no such event", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    chai.assert.isFalse(
      await callAs("removeEventAttendee", "cjb", "evt1", "cjb")
    );
  });

  it("fails when no such user", async function () {
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    await assertRejects(
      callAs("removeEventAttendee", "cjb", "evt1", "cjb"),
      Match.Error
    );
  });

  it("removes attendee", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cjb", "cscott"],
    });
    chai.assert.isTrue(
      await callAs("removeEventAttendee", "cjb", "evt1", "cjb")
    );
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt1" }), {
      _id: "evt1",
      attendees: ["cscott"],
    });
  });

  it("removes someone else", async function () {
    await Meteor.users.insertAsync({ _id: "bjc" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["bjc", "cscott"],
    });
    chai.assert.isTrue(
      await callAs("removeEventAttendee", "cjb", "evt1", "bjc")
    );
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt1" }), {
      _id: "evt1",
      attendees: ["cscott"],
    });
  });

  it("noop when not attending", async function () {
    await Meteor.users.insertAsync({ _id: "cjb" });
    await CalendarEvents.insertAsync({
      _id: "evt1",
      attendees: ["cscott"],
    });
    chai.assert.isTrue(
      await callAs("removeEventAttendee", "cjb", "evt1", "cjb")
    );
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt1" }), {
      _id: "evt1",
      attendees: ["cscott"],
    });
  });
});
