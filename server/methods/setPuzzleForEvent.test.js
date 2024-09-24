// For side effects
import "/lib/model.js";
import { CalendarEvents, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("setPuzzleForEvent", function () {
  beforeEach(() => clearCollections(CalendarEvents, Puzzles));

  it("fails without login", async function () {
    await Puzzles.insertAsync({
      _id: "puzz",
    });
    await CalendarEvents.insertAsync({
      _id: "evt",
    });
    await assertRejects(
      Meteor.callAsync("setPuzzleForEvent", "evt", "puzz"),
      Match.Error
    );
  });

  it("fails when no such puzzle", async function () {
    await CalendarEvents.insertAsync({
      _id: "evt",
    });
    await assertRejects(
      callAs("setPuzzleForEvent", "cjb", "evt", "puzz"),
      Match.Error
    );
  });

  it("fails when no such event", async function () {
    await Puzzles.insertAsync({
      _id: "puzz",
    });
    chai.assert.isFalse(
      await callAs("setPuzzleForEvent", "cjb", "evt", "puzz")
    );
  });

  it("sets unset puzzle", async function () {
    await Puzzles.insertAsync({
      _id: "puzz",
    });
    await CalendarEvents.insertAsync({
      _id: "evt",
    });
    await callAs("setPuzzleForEvent", "cjb", "evt", "puzz");
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt" }), {
      _id: "evt",
      puzzle: "puzz",
    });
  });

  it("overwrites set puzzle", async function () {
    await Puzzles.insertAsync({
      _id: "puzz",
    });
    await CalendarEvents.insertAsync({
      _id: "evt",
      puzzle: "fizz",
    });
    await callAs("setPuzzleForEvent", "cjb", "evt", "puzz");
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt" }), {
      _id: "evt",
      puzzle: "puzz",
    });
  });

  it("unsets puzzle", async function () {
    await Puzzles.insertAsync({
      _id: "puzz",
    });
    await CalendarEvents.insertAsync({
      _id: "evt",
      puzzle: "puzz",
    });
    await callAs("setPuzzleForEvent", "cjb", "evt", null);
    chai.assert.deepEqual(await CalendarEvents.findOneAsync({ _id: "evt" }), {
      _id: "evt",
    });
  });
});
