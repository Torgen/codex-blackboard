// For side effetcs
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("feedMeta", function () {
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
    const meta = await Puzzles.insertAsync({
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
    const leaf = await Puzzles.insertAsync({
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "torgen",
      touched: 2,
      touched_by: "torgen",
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    await assertRejects(Meteor.callAsync("feedMeta", leaf, meta), Match.Error);
  });

  it("adds when not feeding yet", async function () {
    const meta = await Puzzles.insertAsync({
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
    const leaf = await Puzzles.insertAsync({
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
    await callAs("feedMeta", "jeff", leaf, meta);
    chai.assert.deepInclude(await Puzzles.findOneAsync(meta), {
      puzzles: ["yoy", leaf],
      touched: 7,
      touched_by: "jeff",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync(leaf), {
      feedsInto: ["wew", meta],
      touched: 7,
      touched_by: "jeff",
    });
  });

  it("no change when already feeding", async function () {
    const leaf = await Puzzles.insertAsync({
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
    const meta = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: [leaf, "yoy"],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    await Puzzles.updateAsync(leaf, { $addToSet: { feedsInto: meta } });
    await callAs("feedMeta", "jeff", leaf, meta);
    chai.assert.deepInclude(await Puzzles.findOneAsync(meta), {
      puzzles: [leaf, "yoy"],
      touched: 1,
      touched_by: "torgen",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync(leaf), {
      feedsInto: ["wew", meta],
      touched: 2,
      touched_by: "cjb",
    });
  });

  it("makes meta", async function () {
    const meta = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      puzzles: [],
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    const leaf = await Puzzles.insertAsync({
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
    await callAs("feedMeta", "jeff", leaf, meta);
    chai.assert.deepInclude(await Puzzles.findOneAsync(meta), {
      puzzles: [leaf],
      touched: 7,
      touched_by: "jeff",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync(leaf), {
      feedsInto: ["wew", meta],
      touched: 7,
      touched_by: "jeff",
    });
  });

  it("requires meta", async function () {
    const leaf = await Puzzles.insertAsync({
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
    await assertRejects(callAs("feedMeta", "jeff", leaf, "nope"), Meteor.Error);
    chai.assert.deepEqual((await Puzzles.findOneAsync(leaf)).feedsInto, [
      "wew",
    ]);
  });

  it("requires leaf", async function () {
    const meta = await Puzzles.insertAsync({
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
    await assertRejects(callAs("feedMeta", "jeff", "nope", meta), Meteor.Error);
    chai.assert.deepEqual((await Puzzles.findOneAsync(meta)).puzzles, ["yoy"]);
  });
});
