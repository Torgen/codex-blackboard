// For side effects
import "/lib/model.js";
import {
  CalendarEvents,
  Messages,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import { drive } from "/lib/imports/environment.js";
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("deletePuzzle", function () {
  let driveMethods = null;
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
    driveMethods = {
      createPuzzle: sinon.fake.returns({
        id: "fid", // f for folder
        spreadId: "sid",
        docId: "did",
      }),
      renamePuzzle: sinon.spy(),
      deletePuzzle: sinon.spy(),
    };
  });

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  let id = null;
  let meta = null;
  let rid = null;
  let ev = null;
  beforeEach(async function () {
    await clearCollections(CalendarEvents, Messages, Puzzles, Rounds);
    id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      tags: {},
      drive: "ffoo",
      spreadsheet: "sfoo",
      doc: "dfoo",
    });
    meta = await Puzzles.insertAsync({
      name: "Meta",
      canon: "meta",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      tags: {},
      puzzles: [id],
      drive: "fmeta",
      spreadsheet: "smeta",
      doc: "dmeta",
    });
    rid = await Rounds.insertAsync({
      name: "Bar",
      canon: "bar",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      solved: null,
      solved_by: null,
      puzzles: [id, meta],
      tags: {},
    });
    ev = await CalendarEvents.insertAsync({
      puzzle: id,
      summary: "An event!",
    });
  });

  it("fails without login", async function () {
    await assertRejects(Meteor.callAsync("deletePuzzle", id), Match.Error);
  });

  describe("when logged in", function () {
    let ret = null;
    beforeEach(async function () {
      await drive.withValue(driveMethods, async function () {
        ret = await callAs("deletePuzzle", "cjb", id);
      });
    });

    it("oplogs", async function () {
      chai.assert.lengthOf(
        await Messages.find({
          nick: "cjb",
          type: "puzzles",
          room_name: "oplog/0",
        }).fetchAsync(),
        1
      );
    });

    it("removes puzzle from round", async function () {
      chai.assert.deepEqual(await Rounds.findOneAsync(rid), {
        _id: rid,
        name: "Bar",
        canon: "bar",
        created: 1,
        created_by: "torgen",
        touched: 7,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        puzzles: [meta],
        tags: {},
      });
    });

    it("removes puzzle from meta", async function () {
      chai.assert.deepEqual(await Puzzles.findOneAsync(meta), {
        _id: meta,
        name: "Meta",
        canon: "meta",
        created: 1,
        created_by: "torgen",
        touched: 7,
        touched_by: "cjb",
        solved: null,
        solved_by: null,
        puzzles: [],
        tags: {},
        drive: "fmeta",
        spreadsheet: "smeta",
        doc: "dmeta",
      });
    });

    it("removes puzzle from event", async function () {
      chai.assert.deepEqual(await CalendarEvents.findOneAsync(ev), {
        _id: ev,
        summary: "An event!",
      });
    });

    it("deletes drive", function () {
      chai.assert.deepEqual(driveMethods.deletePuzzle.getCall(0).args, [
        "ffoo",
      ]);
    });
  });
});
