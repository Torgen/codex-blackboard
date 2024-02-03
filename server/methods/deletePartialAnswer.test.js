// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
// Test only works on server side; move to /server if you add client tests.
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("deletePartialAnswer", function () {
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

  it("fails when not logged in", function () {
    const id = Puzzles.insert({
      name: "Foo",
      canon: "foo",
      touched: 6,
      touched_by: "bob",
      answers: ["barney", "sheila"],
    });
    chai.assert.throws(
      () => Meteor.call("deletePartialAnswer", id, "barney"),
      Match.Error
    );
  });

  describe("when puzzle is solved", function () {
    let puzzle;

    beforeEach(function () {
      const id = Puzzles.insert({
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
      callAs("deletePartialAnswer", "cjb", id, "barney");
      puzzle = Puzzles.findOne(id);
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

    it("does not oplog", function () {
      chai.assert.isNotOk(Messages.findOne());
    });
  });

  describe("when puzzle is not solved", function () {
    let puzzle;

    beforeEach(function () {
      const id = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        touched: 6,
        touched_by: "bob",
        answers: ["barney", "sheila"],
      });
      callAs("deletePartialAnswer", "cjb", id, "barney");
      puzzle = Puzzles.findOne(id);
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

    it("oplogs", function () {
      chai.assert.include(Messages.findOne(), {
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

    beforeEach(function () {
      const id = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        touched: 6,
        touched_by: "bob",
        answers: ["barney", "sheila"],
      });
      callAs("deletePartialAnswer", "cjb", id, "qux");
      puzzle = Puzzles.findOne(id);
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

    it("does not oplog", function () {
      chai.assert.isNotOk(Messages.findOne());
    });
  });
});
