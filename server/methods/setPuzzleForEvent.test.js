// For side effects
import "/lib/model.js";
import { CalendarEvents, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("setPuzzleForEvent", function () {
  beforeEach(() => resetDatabase());

  it("fails without login", function () {
    Puzzles.insert({
      _id: "puzz",
    });
    CalendarEvents.insert({
      _id: "evt",
    });
    chai.assert.throws(
      () => Meteor.call("setPuzzleForEvent", "evt", "puzz"),
      Match.Error,
    );
  });

  it("fails when no such puzzle", function () {
    CalendarEvents.insert({
      _id: "evt",
    });
    chai.assert.throws(
      () => callAs("setPuzzleForEvent", "cjb", "evt", "puzz"),
      Match.Error,
    );
  });

  it("fails when no such event", function () {
    Puzzles.insert({
      _id: "puzz",
    });
    chai.assert.isFalse(callAs("setPuzzleForEvent", "cjb", "evt", "puzz"));
  });

  it("sets unset puzzle", function () {
    Puzzles.insert({
      _id: "puzz",
    });
    CalendarEvents.insert({
      _id: "evt",
    });
    callAs("setPuzzleForEvent", "cjb", "evt", "puzz");
    chai.assert.deepEqual(CalendarEvents.findOne({ _id: "evt" }), {
      _id: "evt",
      puzzle: "puzz",
    });
  });

  it("overwrites set puzzle", function () {
    Puzzles.insert({
      _id: "puzz",
    });
    CalendarEvents.insert({
      _id: "evt",
      puzzle: "fizz",
    });
    callAs("setPuzzleForEvent", "cjb", "evt", "puzz");
    chai.assert.deepEqual(CalendarEvents.findOne({ _id: "evt" }), {
      _id: "evt",
      puzzle: "puzz",
    });
  });

  it("unsets puzzle", function () {
    Puzzles.insert({
      _id: "puzz",
    });
    CalendarEvents.insert({
      _id: "evt",
      puzzle: "puzz",
    });
    callAs("setPuzzleForEvent", "cjb", "evt", null);
    chai.assert.deepEqual(CalendarEvents.findOne({ _id: "evt" }), {
      _id: "evt",
    });
  });
});
