// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("renameTag", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it("fails without login", function () {
    const id = Puzzles.insert({
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
    chai.assert.throws(
      () =>
        Meteor.call("renameTag", {
          type: "puzzles",
          object: id,
          old_name: "warmth",
          new_name: "temperature",
        }),
      Match.Error
    );
  });

  it("renames tag", function () {
    const id = Puzzles.insert({
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
    callAs("renameTag", "torgen", {
      type: "puzzles",
      object: id,
      old_name: "warMth",
      new_name: "Temperature",
    });

    const post = Puzzles.findOne(id);

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

  it("changes tag case", function () {
    const id = Puzzles.insert({
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
    callAs("renameTag", "torgen", {
      type: "puzzles",
      object: id,
      old_name: "warmth",
      new_name: "warMth",
    });

    const post = Puzzles.findOne(id);

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

  it("requires old tag exist", function () {
    const id = Puzzles.insert({
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
    chai.assert.throws(
      () =>
        callAs("renameTag", "torgen", {
          type: "puzzles",
          object: id,
          old_name: "heat",
          new_name: "Temperature",
        }),
      Meteor.Error
    );
  });

  it("requires new tag not exist", function () {
    const id = Puzzles.insert({
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
    chai.assert.throws(
      () =>
        callAs("renameTag", "torgen", {
          type: "puzzles",
          object: id,
          old_name: "warmth",
          new_name: "Temperature",
        }),
      Meteor.Error
    );
  });

  it("will not set link", function () {
    const id = Puzzles.insert({
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
    chai.assert.throws(
      () =>
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
