import { Messages, Puzzles, Rounds } from "/lib/imports/collections.js";
import Router from "/client/imports/router.js";
import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  promiseCall,
  login,
  logout,
} from "/client/imports/app_test_helpers.js";
import { waitForDocument } from "/lib/imports/testutils.js";
import chai from "chai";

describe("logistics", function () {
  this.timeout(10000);
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  describe("callins", function () {
    it("marks puzzle solved", async function () {
      await Router.LogisticsPage();
      await waitForSubscriptions();
      let pb = Puzzles.findOne({ name: "Puzzle Box" });
      await promiseCall("deleteAnswer", { target: pb._id });
      chai.assert.isNotOk(pb.solved);
      chai.assert.isNotOk(pb.tags.answer);
      await promiseCall("newCallIn", {
        callin_type: "answer",
        target_type: "puzzles",
        target: pb._id,
        answer: "teferi",
      });
      await afterFlushPromise();
      const correctButtons = $(".bb-callin-correct");
      chai.assert.equal(correctButtons.length, 1);
      correctButtons.click();
      await waitForMethods();
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isOk(pb.solved);
      chai.assert.equal(pb.tags.answer.value, "teferi");
    });

    it("gets disappointed", async function () {
      await Router.LogisticsPage();
      await waitForSubscriptions();
      let pb = Puzzles.findOne({ name: "Puzzle Box" });
      await promiseCall("deleteAnswer", { target: pb._id });
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      chai.assert.isNotOk(pb.tags.answer);
      await promiseCall("newCallIn", {
        callin_type: "answer",
        target_type: "puzzles",
        target: pb._id,
        answer: "teferi",
      });
      await afterFlushPromise();
      const incorrectButtons = $(".bb-callin-incorrect");
      chai.assert.equal(incorrectButtons.length, 1);
      incorrectButtons.click();
      await waitForMethods();
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      const msg = Messages.findOne({
        room_name: "general/0",
        nick: "testy",
        action: true,
        body: /^sadly relays/,
      });
      chai.assert.isOk(msg);
    });

    it("accepts explanation on accepted interaction request", async function () {
      await Router.LogisticsPage();
      await waitForSubscriptions();
      let pb = Puzzles.findOne({ name: "Puzzle Box" });
      await promiseCall("deleteAnswer", { target: pb._id });
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      chai.assert.isNotOk(pb.tags.answer);
      await promiseCall("newCallIn", {
        callin_type: "interaction request",
        target_type: "puzzles",
        target: pb._id,
        answer: "teferi",
      });
      await afterFlushPromise();
      $("input.response").val("phasing");
      const correctButtons = $(".bb-callin-correct");
      chai.assert.equal(correctButtons.length, 1);
      correctButtons.click();
      await waitForMethods();
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      const msg = Messages.findOne({
        room_name: "general/0",
        nick: "testy",
        action: true,
        body: 'reports that the interaction request "teferi" was ACCEPTED with response "phasing"! (Puzzle Box)',
      });
      chai.assert.isOk(msg);
    });

    it("accepts explanation on rejected interaction request", async function () {
      await Router.LogisticsPage();
      await waitForSubscriptions();
      let pb = Puzzles.findOne({ name: "Puzzle Box" });
      await promiseCall("deleteAnswer", { target: pb._id });
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      chai.assert.isNotOk(pb.tags.answer);
      await promiseCall("newCallIn", {
        callin_type: "interaction request",
        target_type: "puzzles",
        target: pb._id,
        answer: "teferi",
      });
      await afterFlushPromise();
      $("input.response").val("phasing");
      const incorrectButtons = $(".bb-callin-incorrect");
      chai.assert.equal(incorrectButtons.length, 1);
      incorrectButtons.click();
      await waitForMethods();
      pb = Puzzles.findOne({ name: "Puzzle Box" });
      chai.assert.isNotOk(pb.solved);
      const msg = Messages.findOne({
        room_name: "general/0",
        nick: "testy",
        action: true,
        body: 'sadly relays that the interaction request "teferi" was REJECTED with response "phasing". (Puzzle Box)',
      });
      chai.assert.isOk(msg);
    });
  });

  describe("new round button", function () {
    describe("when clicked", function () {
      it("creates round on enter", async function () {
        await Router.LogisticsPage();
        await waitForSubscriptions();
        const $newRound = $("#bb-logistics-new-round");
        $newRound.mousedown().click();
        await afterFlushPromise();
        console.log("after flush");
        const $input = $newRound.find("input");
        chai.assert.isOk($input.get(), "input exists");
        chai.assert.isTrue($input.is(":focus"), "input is focused");
        $input
          .val("new round by click")
          .trigger(new $.Event("keyup", { which: 13 }));
        const newRound = await waitForDocument(Rounds, {
          name: "new round by click",
        });
        try {
          chai.assert.deepInclude(newRound, {
            created_by: "testy",
          });
        } finally {
          await promiseCall("deleteRound", newRound._id);
        }
      });
    });
  });

  describe("new meta button", function () {
    describe("when clicked", function () {
      it("creates meta in round", async function () {
        await Router.LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "new round for meta",
        });
        try {
          const $newMeta = $("#bb-logistics-new-meta");
          $newMeta.click();
          await afterFlushPromise();
          $newMeta.find(`a[data-round-id="${round._id}"]`).click();
          await afterFlushPromise();
          const $focus = $(":focus");
          chai.assert.isOk($focus.get(), "something is focused");
          $focus
            .val("new meta in round")
            .trigger(new $.Event("keyup", { which: 13 }));
          const newMeta = await waitForDocument(Puzzles, {
            name: "new meta in round",
          });
          try {
            chai.assert.deepInclude(newMeta, {
              created_by: "testy",
              puzzles: [],
            });
            await afterFlushPromise();
            const $meta = $(
              `.bb-logistics-meta[data-puzzle-id="${newMeta._id}"]`
            );
            chai.assert.isOk($meta.get());
            chai.assert.equal(
              $meta.find("header .round").text(),
              "new round for meta"
            );
            chai.assert.equal(
              $meta.find("header .puzzle-name").text(),
              "new meta in round"
            );
          } finally {
            await promiseCall("deletePuzzle", newMeta._id);
          }
        } finally {
          await promiseCall("deleteRound", round._id);
        }
      });
    });
  });

  describe("new standalone button", function () {
    describe("when clicked", function () {
      it("creates standalone in round", async function () {
        await Router.LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "new round for standalone",
        });
        try {
          const $newStandalone = $("#bb-logistics-new-standalone");
          $newStandalone.click();
          await afterFlushPromise();
          $newStandalone.find(`a[data-round-id="${round._id}"]`).click();
          await afterFlushPromise();
          const $focus = $(":focus");
          chai.assert.isOk($focus.get(), "something is focused");
          $focus
            .val("new standalone in round")
            .trigger(new $.Event("keyup", { which: 13 }));
          const puzzle = await waitForDocument(Puzzles, {
            name: "new standalone in round",
          });
          try {
            chai.assert.deepInclude(puzzle, {
              created_by: "testy",
            });
            chai.assert.doesNotHaveAnyKeys(puzzle, ["puzzles"]);
            await afterFlushPromise();
            const $puzzle = $(`a[href="/puzzles/${puzzle._id}"]`);
            chai.assert.isOk($puzzle.get());
            chai.assert.equal(
              $puzzle.find(".puzzle-name").text(),
              "new standalone in round"
            );
          } finally {
            await promiseCall("deletePuzzle", puzzle._id);
          }
        } finally {
          await promiseCall("deleteRound", round._id);
        }
      });
    });
  });
});
