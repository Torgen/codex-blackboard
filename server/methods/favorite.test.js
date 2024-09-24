// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("favorite", function () {
  let clock = null;
  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  beforeEach(() => clearCollections(Puzzles));

  describe("when no such puzzle", function () {
    it("fails without login", async function () {
      await assertRejects(Meteor.callAsync("favorite", "id"), Match.Error);
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("favorite", "cjb", "id");
      });

      it("returns false", () => chai.assert.isFalse(ret));
    });
  });

  describe("when favorites is absent", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "fid",
        spreadsheet: "sid",
        doc: "did",
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(Meteor.callAsync("favorite", id), Match.Error);
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("favorite", "cjb", id);
      });

      it("returns true", () => chai.assert.isTrue(ret));

      it("sets favorites", async function () {
        chai.assert.deepEqual((await Puzzles.findOneAsync(id)).favorites, {
          cjb: true,
        });
      });

      it("does not touch", async function () {
        const doc = await Puzzles.findOneAsync(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });

  describe("when favorites has others", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        favorites: {
          torgen: true,
          cscott: true,
        },
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "fid",
        spreadsheet: "sid",
        doc: "did",
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(Meteor.callAsync("favorite", id), Match.Error);
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("favorite", "cjb", id);
      });

      it("returns true", () => chai.assert.isTrue(ret));

      it("sets favorites", async function () {
        chai.assert.deepEqual((await Puzzles.findOneAsync(id)).favorites, {
          torgen: true,
          cscott: true,
          cjb: true,
        });
      });

      it("does not touch", async function () {
        const doc = await Puzzles.findOneAsync(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });

  describe("when favorites has self", function () {
    let id = null;
    beforeEach(async function () {
      id = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        solved: null,
        solved_by: null,
        favorites: {
          torgen: true,
          cjb: true,
        },
        link: "https://puzzlehunt.mit.edu/foo",
        drive: "fid",
        spreadsheet: "sid",
        doc: "did",
        tags: {},
      });
    });

    it("fails without login", async function () {
      await assertRejects(Meteor.callAsync("favorite", id), Match.Error);
    });

    describe("when logged in", function () {
      let ret = null;
      beforeEach(async function () {
        ret = await callAs("favorite", "cjb", id);
      });

      it("returns true", () => chai.assert.isTrue(ret));

      it("leaves favorites unchanged", async function () {
        chai.assert.deepEqual((await Puzzles.findOneAsync(id)).favorites, {
          torgen: true,
          cjb: true,
        });
      });

      it("does not touch", async function () {
        const doc = await Puzzles.findOneAsync(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });
});
