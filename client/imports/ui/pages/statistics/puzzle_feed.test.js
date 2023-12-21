import PuzzleFeed from "./puzzle_feed.js";
import { assert } from "chai";
import { spy } from "sinon";

describe("puzzle feed", () =>
  it("adds", function () {
    const callback = spy();
    const p = new PuzzleFeed("timestamp", callback);
    p.addedAt({ timestamp: 1000 }, 0);
    p.addedAt({ timestamp: 2000 }, 1);
    p.addedAt({ timestamp: 1500 }, 1);
    assert.isTrue(callback.calledThrice, "initial");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 }
    ]);
    callback.resetHistory();
    Session.set("currentTime", 2500);
    p.updateNow();
    assert.isTrue(callback.calledOnce, "set now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 2500, y: 3 }
    ]);
    callback.resetHistory();
    Session.set("currentTime", 3000);
    p.updateNow();
    assert.isTrue(callback.calledOnce, "update now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 3000, y: 3 }
    ]);
    callback.resetHistory();
    p.addedAt({ timestamp: 2500 }, 3);
    assert.isTrue(callback.calledOnce, "insert before now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 2500, y: 4 },
      { x: 3000, y: 4 }
    ]);
    callback.resetHistory();
    p.addedAt({ timestamp: 3500 }, 4);
    assert.isTrue(callback.calledOnce, "append after now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 2500, y: 4 },
      { x: 3500, y: 5 }
    ]);
    callback.resetHistory();
    Session.set("currentTime", 4000);
    p.updateNow();
    p.changedAt({ timestamp: 4500 }, { timestamp: 3500 }, 4);
    assert.isTrue(callback.calledTwice, "move after now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 2500, y: 4 },
      { x: 4500, y: 5 }
    ]);
    callback.resetHistory();
    p.removedAt({ timestamp: 4500 }, 4);
    assert.isTrue(callback.calledOnce, "delete after now");
    assert.deepEqual(p.data, [
      { x: 1000, y: 1 },
      { x: 1500, y: 2 },
      { x: 2000, y: 3 },
      { x: 2500, y: 4 },
      { x: 4000, y: 4 }
    ]);
  }));
