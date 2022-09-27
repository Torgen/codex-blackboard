import { Messages, Puzzles } from "/lib/imports/collections.js";
import Router from "/client/imports/router.js";
import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  promiseCall,
  login,
  logout,
} from "/client/imports/app_test_helpers.js";
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
});
