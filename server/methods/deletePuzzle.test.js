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
import { resetDatabase } from "meteor/xolvio:cleaner";

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
  beforeEach(function () {
    resetDatabase();
    id = Puzzles.insert({
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
    meta = Puzzles.insert({
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
    rid = Rounds.insert({
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
    ev = CalendarEvents.insert({
      puzzle: id,
      summary: "An event!",
    });
  });

  it("fails without login", () =>
    chai.assert.throws(() => Meteor.call("deletePuzzle", id), Match.Error));

  describe("when logged in", function () {
    let ret = null;
    beforeEach(() =>
      drive.withValue(
        driveMethods,
        () => (ret = callAs("deletePuzzle", "cjb", id)),
      ),
    );

    it("oplogs", () =>
      chai.assert.lengthOf(
        Messages.find({
          nick: "cjb",
          type: "puzzles",
          room_name: "oplog/0",
        }).fetch(),
        1,
      ));

    it("removes puzzle from round", () =>
      chai.assert.deepEqual(Rounds.findOne(rid), {
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
      }));

    it("removes puzzle from meta", () =>
      chai.assert.deepEqual(Puzzles.findOne(meta), {
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
      }));

    it("removes puzzle from event", () =>
      chai.assert.deepEqual(CalendarEvents.findOne(ev), {
        _id: ev,
        summary: "An event!",
      }));

    it("deletes drive", () =>
      chai.assert.deepEqual(driveMethods.deletePuzzle.getCall(0).args, [
        "ffoo",
      ]));
  });
});
