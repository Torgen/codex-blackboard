// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("unfeedMeta", function () {
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Puzzles));

  it("fails without login", async function () {
    await Puzzles.insertAsync({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy", "leaf"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    await Puzzles.insertAsync({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["meta"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    await assertRejects(
      Meteor.callAsync("feedMeta", "leaf", "meta"),
      Match.Error
    );
  });

  it("removes when feeding", async function () {
    await Puzzles.insertAsync({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy", "leaf"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    await Puzzles.insertAsync({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew", "meta"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    await callAs("unfeedMeta", "jeff", "leaf", "meta");
    chai.assert.deepInclude(await Puzzles.findOneAsync("meta"), {
      puzzles: ["yoy"],
      touched: 7,
      touched_by: "jeff",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync("leaf"), {
      feedsInto: ["wew"],
      touched: 7,
      touched_by: "jeff",
    });
  });

  it("no-op when not feeding", async function () {
    await Puzzles.insertAsync({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    await Puzzles.insertAsync({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    await callAs("unfeedMeta", "jeff", "leaf", "meta");
    chai.assert.deepInclude(await Puzzles.findOneAsync("meta"), {
      puzzles: ["yoy"],
      touched: 1,
      touched_by: "torgen",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync("leaf"), {
      feedsInto: ["wew"],
      touched: 2,
      touched_by: "cjb",
    });
  });

  it("requires meta", async function () {
    await Puzzles.insertAsync({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    await assertRejects(
      callAs("unfeedMeta", "jeff", "leaf", "meta"),
      Meteor.Error
    );
    chai.assert.deepEqual((await Puzzles.findOneAsync("leaf")).feedsInto, [
      "wew",
    ]);
  });

  it("requires leaf", async function () {
    await Puzzles.insertAsync({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy"],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    await assertRejects(
      callAs("unfeedMeta", "jeff", "leaf", "meta"),
      Meteor.Error
    );
    chai.assert.deepEqual((await Puzzles.findOneAsync("meta")).puzzles, [
      "yoy",
    ]);
  });
});
