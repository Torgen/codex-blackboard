import AnswerSoundHandler from "./answer_sound.js";
import { ReactiveVar } from "meteor/reactive-var";
import { afterFlushPromise } from "/client/imports/app_test_helpers.js";
import chai from "chai";
import sinon from "sinon";

describe("AnswerSoundHandler", function () {
  let puzzles;
  let playAnswer;
  let playPartialAnswer;
  let handler;
  let userVar;
  let userStub;
  let clock;
  beforeEach(function () {
    userVar = new ReactiveVar(null);
    userStub = sinon.stub(Meteor, "user").callsFake(() => userVar.get());
    puzzles = new Mongo.Collection(null);
    playAnswer = sinon.stub();
    playPartialAnswer = sinon.stub();
    clock = sinon.useFakeTimers({ now: 1000000, toFake: ["Date"] });
    handler = new AnswerSoundHandler(puzzles, playAnswer, playPartialAnswer);
  });
  afterEach(function () {
    handler.stop();
    clock.restore();
    userStub.restore();
  });
  it("does not play sound when puzzles are already solved on login", async function () {
    handler.start();
    puzzles.insert({ solved: 999999 });
    userVar.set("somebody");
    await afterFlushPromise();
    chai.assert.equal(playAnswer.callCount, 0);
    chai.assert.equal(playPartialAnswer.callCount, 0);
  });
  it("plays sound when puzzle becomes solved", function () {
    userVar.set("somebody");
    handler.start();
    const id = puzzles.insert({ solved: 1001000 });
    chai.assert.equal(playAnswer.callCount, 1);
    chai.assert.deepEqual(playAnswer.firstCall.args, [id]);
    chai.assert.equal(playPartialAnswer.callCount, 0);
  });
  it("does not play sound again when same puzzle answer is updated", function () {
    userVar.set("somebody");
    handler.start();
    const id = puzzles.insert({ solved: 1001000 });
    puzzles.update(id, { $set: { solved: 1002000 } });
    chai.assert.equal(playAnswer.callCount, 1);
    chai.assert.equal(playPartialAnswer.callCount, 0);
  });
  it("does not play sound again if puzzle becomes unsolved", function () {
    userVar.set("somebody");
    handler.start();
    puzzles.insert({ solved: 1001000 });
    const id = puzzles.insert({ solved: 1002000 });
    chai.assert.equal(playAnswer.callCount, 2);
    puzzles.remove(id);
    chai.assert.equal(playAnswer.callCount, 2);
    chai.assert.equal(playPartialAnswer.callCount, 0);
  });
  it("plays partial answer sound again for same puzzle", function () {
    userVar.set("somebody");
    handler.start();
    const id = puzzles.insert({ last_partial_answer: 1001000 });
    puzzles.update(id, { $set: { last_partial_answer: 1002000 } });
    chai.assert.equal(playAnswer.callCount, 0);
    chai.assert.equal(playPartialAnswer.callCount, 2);
    chai.assert.deepEqual(playPartialAnswer.firstCall.args, [1001000]);
    chai.assert.deepEqual(playPartialAnswer.secondCall.args, [1002000]);
  });
  it("plays solved only for last partial answer", function () {
    userVar.set("somebody");
    handler.start();
    const id = puzzles.insert({
      solved: 1001000,
      last_partial_answer: 1001000,
    });
    chai.assert.equal(playAnswer.callCount, 1);
    chai.assert.deepEqual(playAnswer.firstCall.args, [id]);
    chai.assert.equal(playPartialAnswer.callCount, 0);
  });
});
