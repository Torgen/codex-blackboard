// For side effects
import "/lib/model.js";
import { Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("moveRound", function () {
  let clock = null;
  let id1 = null;
  let id2 = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(async function () {
    await clearCollections(Rounds);
    id1 = await Rounds.insertAsync({
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      sort_key: 1,
      puzzles: ["yoy"],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    id2 = await Rounds.insertAsync({
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      sort_key: 2,
      puzzles: ["harumph"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
  });

  it("fails without login", async function () {
    await assertRejects(Meteor.callAsync("moveRound", id1, 1), Match.Error);
  });

  describe("when logged in", function () {
    it("moves later", async function () {
      await callAs("moveRound", "jeff", id1, 1);
      chai.assert.include(await Rounds.findOneAsync(id1), {
        created: 1,
        touched: 1,
        sort_key: 2,
      });
      chai.assert.include(await Rounds.findOneAsync(id2), {
        created: 2,
        touched: 2,
        sort_key: 1,
      });
    });

    it("moves earlier", async function () {
      await callAs("moveRound", "jeff", id2, -1);
      chai.assert.include(await Rounds.findOneAsync(id1), {
        created: 1,
        touched: 1,
        sort_key: 2,
      });
      chai.assert.include(await Rounds.findOneAsync(id2), {
        created: 2,
        touched: 2,
        sort_key: 1,
      });
    });

    it("bounces off top", async function () {
      await callAs("moveRound", "jeff", id1, -1);
      chai.assert.include(await Rounds.findOneAsync(id1), {
        created: 1,
        touched: 1,
        sort_key: 1,
      });
      chai.assert.include(await Rounds.findOneAsync(id2), {
        created: 2,
        touched: 2,
        sort_key: 2,
      });
    });

    it("bounces off bottom", async function () {
      await callAs("moveRound", "jeff", id2, 1);
      chai.assert.include(await Rounds.findOneAsync(id1), {
        created: 1,
        touched: 1,
        sort_key: 1,
      });
      chai.assert.include(await Rounds.findOneAsync(id2), {
        created: 2,
        touched: 2,
        sort_key: 2,
      });
    });
  });
});
