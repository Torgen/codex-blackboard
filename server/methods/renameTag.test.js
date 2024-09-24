// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("renameTag", function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await assertRejects(
      Meteor.callAsync("renameTag", {
        type: "puzzles",
        object: id,
        old_name: "warmth",
        new_name: "temperature",
      }),
      Match.Error
    );
  });

  it("fails when object doesn't exist", async function () {
    await assertRejects(
      callAs("renameTag", "torgen", {
        type: "puzzles",
        object: "never heard of it",
        old_name: "warMth",
        new_name: "Temperature",
      }),
      Meteor.Error
    );
  });

  it("renames tag", async function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await callAs("renameTag", "torgen", {
      type: "puzzles",
      object: id,
      old_name: "warMth",
      new_name: "Temperature",
    });

    const post = await Puzzles.findOneAsync(id);

    chai.assert.deepInclude(post, {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      tags: {
        temperature: {
          name: "Temperature",
          value: "bar",
          touched: 7,
          touched_by: "torgen",
        },
      },
    });
  });

  it("changes tag case", async function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await callAs("renameTag", "torgen", {
      type: "puzzles",
      object: id,
      old_name: "warmth",
      new_name: "warMth",
    });

    const post = await Puzzles.findOneAsync(id);

    chai.assert.deepInclude(post, {
      created: 1,
      created_by: "cjb",
      touched: 7,
      touched_by: "torgen",
      tags: {
        warmth: {
          name: "warMth",
          value: "bar",
          touched: 7,
          touched_by: "torgen",
        },
      },
    });
  });

  it("requires old tag exist", async function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await assertRejects(
      callAs("renameTag", "torgen", {
        type: "puzzles",
        object: id,
        old_name: "heat",
        new_name: "Temperature",
      }),
      Meteor.Error
    );
  });

  it("requires new tag not exist", async function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
        temperature: {
          name: "Temperature",
          value: "4degC",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await assertRejects(
      callAs("renameTag", "torgen", {
        type: "puzzles",
        object: id,
        old_name: "warmth",
        new_name: "Temperature",
      }),
      Meteor.Error
    );
  });

  it("will not set link", async function () {
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
        warmth: {
          name: "Warmth",
          value: "bar",
          touched_by: "cscott",
          touched: 3,
        },
      },
    });
    await assertRejects(
      callAs("renameTag", "torgen", {
        type: "puzzles",
        object: id,
        old_name: "warmth",
        new_name: "Link",
      }),
      Match.Error
    );
  });
});
