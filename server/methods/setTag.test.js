// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("setTag", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages, Puzzles));

  it("fails without login", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      feedsInto: [],
      created: 1,
      created_by: "cjb",
      touched: 3,
      touched_by: "cscott",
      solved: 3,
      solved_by: "cscott",
      tags: {
        answer: {
          name: "Answer",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await assertRejects(
      Meteor.callAsync("setTag", {
        type: "puzzles",
        object: id,
        name: "Cares About",
        value: "temperature",
      }),
      Match.Error
    );
  });

  it("adds new tag", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      feedsInto: [],
      created: 1,
      created_by: "cjb",
      touched: 3,
      touched_by: "cscott",
      solved: 3,
      solved_by: "cscott",
      tags: {
        answer: {
          name: "Answer",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await callAs("setTag", "torgen", {
      type: "puzzles",
      object: id,
      name: "Cares About",
      value: "temperature",
    });
    chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      solved: 3,
      solved_by: "cscott",
      tags: {
        answer: {
          name: "Answer",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 7,
          touched_by: "torgen",
        },
      },
    });
  });

  it("overwrites old tag", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      feedsInto: [],
      created: 1,
      created_by: "cjb",
      touched: 3,
      touched_by: "cscott",
      tags: {
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 3,
          touched_by: "cscott",
        },
      },
    });
    await callAs("setTag", "torgen", {
      type: "puzzles",
      object: id,
      name: "Cares About",
      value: "temperature,pressure",
    });

    chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      tags: {
        cares_about: {
          name: "Cares About",
          value: "temperature,pressure",
          touched: 7,
          touched_by: "torgen",
        },
      },
    });
  });

  it("defers to setAnswer", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      feedsInto: [],
      created: 1,
      created_by: "cjb",
      touched: 3,
      touched_by: "cscott",
      tags: {
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 3,
          touched_by: "cscott",
        },
      },
    });
    await callAs("setTag", "torgen", {
      type: "puzzles",
      object: id,
      name: "answEr",
      value: "bar",
    });

    chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      solved: 7,
      solved_by: "torgen",
      tags: {
        answer: {
          name: "Answer",
          value: "bar",
          touched_by: "torgen",
          touched: 7,
        },
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 3,
          touched_by: "cscott",
        },
      },
    });
    chai.assert.include(
      await Messages.findOneAsync({
        room_name: "oplog/0",
        body: "Found an answer (BAR) to",
      }),
      {
        id,
        nick: "torgen",
        oplog: true,
        type: "puzzles",
        stream: "answers",
      }
    );
  });

  it("sets link", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      feedsInto: [],
      created: 1,
      created_by: "cjb",
      touched: 3,
      touched_by: "cscott",
      tags: {
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 3,
          touched_by: "cscott",
        },
      },
    });
    await callAs("setTag", "torgen", {
      type: "puzzles",
      object: id,
      name: "link",
      value: "https://moliday.holasses/puzzles/foo",
    });

    chai.assert.deepInclude(await Puzzles.findOneAsync(id), {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      link: "https://moliday.holasses/puzzles/foo",
      tags: {
        cares_about: {
          name: "Cares About",
          value: "temperature",
          touched: 3,
          touched_by: "cscott",
        },
      },
    });
    chai.assert.doesNotHaveAnyKeys((await Puzzles.findOneAsync(id)).tags, [
      "link",
    ]);
  });

  describe("on metapuzzle", function () {
    let meta;
    let feeder;
    beforeEach(async function () {
      meta = await Puzzles.insertAsync({
        name: "Meta",
        canon: "meta",
        feedsInto: [],
        puzzles: [],
        created: 1,
        created_by: "cjb",
        touched: 3,
        touched_by: "cscott",
        tags: {},
      });
      feeder = await Puzzles.insertAsync({
        name: "Feeder",
        canon: "feeder",
        feedsInto: [meta],
        created: 1,
        created_by: "cjb",
        touched: 3,
        touched_by: "cscott",
        tags: {
          baz: {
            name: "Baz",
            value: "bob",
            touched: 3,
            touched_by: "cscott",
          },
        },
      });
      await Puzzles.updateAsync(meta, { $push: { puzzles: feeder } });
    });

    it("notifies feeder on meta tags", async function () {
      await callAs("setTag", "torgen", {
        type: "puzzles",
        object: meta,
        name: "meta pattern",
        value: "crystalline",
      });
      const message = await Messages.findOneAsync({
        room_name: `puzzles/${feeder}`,
      });
      chai.assert.deepInclude(message, {
        nick: "torgen",
        action: true,
        on_behalf: true,
        body: 'has set the meta pattern of Meta to "crystalline".',
      });
    });
    it("notifies feeder on many unset cares abouts", async function () {
      await callAs("setTag", "torgen", {
        type: "puzzles",
        object: meta,
        name: "cares about",
        value: "foo,bar,baz,qux,sheila",
      });
      const message = await Messages.findOneAsync({
        room_name: `puzzles/${feeder}`,
      });
      chai.assert.deepInclude(message, {
        nick: "torgen",
        action: true,
        on_behalf: true,
        body: 'would like the "foo", "bar", "qux", and "sheila" tags set for Meta.',
      });
    });
    it("notifies feeder on two unset cares abouts", async function () {
      await callAs("setTag", "torgen", {
        type: "puzzles",
        object: meta,
        name: "cares about",
        value: "foo,baz,sheila",
      });
      const message = await Messages.findOneAsync({
        room_name: `puzzles/${feeder}`,
      });
      chai.assert.deepInclude(message, {
        nick: "torgen",
        action: true,
        on_behalf: true,
        body: 'would like the "foo" and "sheila" tags set for Meta.',
      });
    });
    it("notifies feeder on one unset cares about", async function () {
      await callAs("setTag", "torgen", {
        type: "puzzles",
        object: meta,
        name: "cares about",
        value: "foo,baz",
      });
      const message = await Messages.findOneAsync({
        room_name: `puzzles/${feeder}`,
      });
      chai.assert.deepInclude(message, {
        nick: "torgen",
        action: true,
        on_behalf: true,
        body: 'would like the "foo" tag set for Meta.',
      });
    });
    it("does not notify feeder on set cares about", async function () {
      await callAs("setTag", "torgen", {
        type: "puzzles",
        object: meta,
        name: "cares about",
        value: "baz",
      });
      chai.assert.notOk(
        await Messages.findOneAsync({ room_name: `puzzles/${feeder}` })
      );
    });
  });
});
