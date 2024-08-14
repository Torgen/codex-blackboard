// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("deletePartialAnswer", function () {
  let clock = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Messages, Puzzles));

  it("fails when not logged in", async function () {
    const id = await Puzzles.insertAsync({
      name: "Foo",
      canon: "foo",
      touched: 6,
      touched_by: "bob",
      answers: ["barney", "sheila"],
    });
    await assertRejects(
      Meteor.callAsync("deletePartialAnswer", id, "barney"),
      Match.Error
    );
  });

  describe("when puzzle is solved", function () {
    let puzzle;

    beforeEach(async function () {
      const id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        solved: 6,
        solved_by: "bob",
        touched: 6,
        touched_by: "bob",
        answers: ["barney", "sheila"],
        tags: {
          answer: {
            value: "barney; sheila",
          },
        },
      });
      await callAs("deletePartialAnswer", "cjb", id, "barney");
      puzzle = await Puzzles.findOneAsync(id);
    });

    it("does not touch", function () {
      chai.assert.include(puzzle, {
        touched: 6,
        touched_by: "bob",
      });
    });

    it("does not remove answer", function () {
      chai.assert.deepEqual(puzzle.answers, ["barney", "sheila"]);
    });

    it("does not oplog", async function () {
      chai.assert.isNotOk(await Messages.findOneAsync());
    });
  });

  describe("when puzzle is not solved", function () {
    let puzzle;

    beforeEach(async function () {
      const id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        touched: 6,
        touched_by: "bob",
        answers: ["barney", "sheila"],
      });
      await callAs("deletePartialAnswer", "cjb", id, "barney");
      puzzle = await Puzzles.findOneAsync(id);
    });

    it("touches", function () {
      chai.assert.include(puzzle, {
        touched: 7,
        touched_by: "cjb",
      });
    });

    it("removes answer", function () {
      chai.assert.deepEqual(puzzle.answers, ["sheila"]);
    });

    it("oplogs", async function () {
      chai.assert.include(await Messages.findOneAsync(), {
        nick: "cjb",
        timestamp: 7,
        room_name: "oplog/0",
        type: "puzzles",
        id: puzzle._id,
        oplog: true,
        followup: true,
        action: true,
        system: false,
        to: null,
        stream: "",
      });
    });
  });

  describe("when puzzle does not have that answer", function () {
    let puzzle;

    beforeEach(async function () {
      const id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        touched: 6,
        touched_by: "bob",
        answers: ["barney", "sheila"],
      });
      await callAs("deletePartialAnswer", "cjb", id, "qux");
      puzzle = await Puzzles.findOneAsync(id);
    });

    it("does not touch", function () {
      chai.assert.include(puzzle, {
        touched: 6,
        touched_by: "bob",
      });
    });

    it("does not remove answer", function () {
      chai.assert.deepEqual(puzzle.answers, ["barney", "sheila"]);
    });

    it("does not oplog", async function () {
      chai.assert.isNotOk(await Messages.findOneAsync());
    });
  });
});
