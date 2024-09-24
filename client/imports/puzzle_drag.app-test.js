import { Puzzles, Rounds } from "/lib/imports/collections.js";
import { EditPage } from "/client/imports/router.js";
import PuzzleDrag from "./puzzle_drag.js";
import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  login,
  logout,
} from "./app_test_helpers.js";
import chai from "chai";

// Because the security model doesn't let you create a DragEvent from JS, we have to extract the relevant bits from the
// event and pass them to another class to handle the logic.

describe("drag-and-drop", function () {
  this.timeout(15000);
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  it("allows drag and drop within a meta", async function () {
    EditPage();
    await waitForSubscriptions();
    await afterFlushPromise();
    const round = () => Rounds.findOne({ name: "Civilization" });
    const meta = () => Puzzles.findOne({ name: "St. Andrew's Links" });
    const metaId = meta()._id;
    const pos = Puzzles.findOne({ name: "Part Of Speech" });
    const invent = Puzzles.findOne({ name: "Inventory Quest" });
    const kids = Puzzles.findOne({ name: "Fascinating Kids" });
    const posJQ = $(`#m${metaId} tr[data-puzzle-id=\"${pos._id}\"]`);
    const inventJQ = $(`#m${metaId} tr[data-puzzle-id=\"${invent._id}\"]`);
    const kidsJQ = $(`#m${metaId} tr[data-puzzle-id=\"${kids._id}\"]`);
    // Ensure they start in the right order
    chai.assert.isBelow(
      posJQ.offset().top,
      inventJQ.offset().top,
      "before drag 1"
    );
    chai.assert.isAbove(
      kidsJQ.offset().top,
      inventJQ.offset().top,
      "before drag 2"
    );
    const dt = new DataTransfer();
    const drag = new PuzzleDrag(
      invent,
      meta(),
      round(),
      inventJQ[0],
      inventJQ[0].getBoundingClientRect().top + 10,
      dt
    );
    chai.assert.include(dt.types, "application/prs.codex-puzzle");
    chai.assert.isTrue(
      drag.dragover(
        invent,
        meta(),
        round(),
        inventJQ[0],
        inventJQ[0].getBoundingClientRect().top + 12,
        dt
      )
    );
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.isBelow(
      posJQ.offset().top,
      inventJQ.offset().top,
      "drag on self 1"
    );
    chai.assert.isAbove(
      kidsJQ.offset().top,
      inventJQ.offset().top,
      "drag on self 2"
    );
    chai.assert.isTrue(
      drag.dragover(
        kids,
        meta(),
        round(),
        kidsJQ[0],
        kidsJQ[0].getBoundingClientRect().top + 9,
        dt
      )
    );
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.isAbove(
      kidsJQ.offset().top,
      inventJQ.offset().top,
      "not far enough down"
    );
    chai.assert.isTrue(
      drag.dragover(
        kids,
        meta(),
        round(),
        kidsJQ[0],
        kidsJQ[0].getBoundingClientRect().top + 11,
        dt
      )
    );
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.isBelow(
      kidsJQ.offset().top,
      inventJQ.offset().top,
      "after drag down"
    );
    chai.assert.isTrue(
      drag.dragover(
        pos,
        meta(),
        round(),
        posJQ[0],
        posJQ[0].getBoundingClientRect().bottom - 4,
        dt
      )
    );
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.isBelow(
      posJQ.offset().top,
      inventJQ.offset().top,
      "after drag up 1"
    );
    chai.assert.isAbove(
      kidsJQ.offset().top,
      inventJQ.offset().top,
      "after drag up 2"
    );
  });
});
