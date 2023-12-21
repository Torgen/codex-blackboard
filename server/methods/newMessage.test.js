// For side effects
import "./newMessage.js";
import { Messages } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("newMessage", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"]
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  describe("bodyIsHtml", function () {
    it("strips script", function () {
      const msg = callAs("newMessage", "torgen", {
        bodyIsHtml: true,
        body: 'Haha <script>alert("ownd")</script> you'
      });
      chai.assert.deepEqual(Messages.findOne(msg._id), {
        _id: msg._id,
        room_name: "general/0",
        nick: "torgen",
        bodyIsHtml: true,
        timestamp: 7,
        body: "Haha  you"
      });
    });

    it("allows classes", function () {
      const msg = callAs("newMessage", "torgen", {
        bodyIsHtml: true,
        body: 'has requested help: stuck (puzzle <a target=_blank href="/puzzles/2">Example</a>)',
        action: true
      });
      chai.assert.deepEqual(Messages.findOne(msg._id), {
        _id: msg._id,
        room_name: "general/0",
        nick: "torgen",
        bodyIsHtml: true,
        timestamp: 7,
        action: true,
        body: 'has requested help: stuck (puzzle <a target="_blank" href="/puzzles/2">Example</a>)'
      });
    });
  });
});
