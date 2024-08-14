import { Rounds, Puzzles } from "/lib/imports/collections.js";
import { BlackboardPage, EditPage } from "/client/imports/router.js";
import {
  waitForMethods,
  waitForSubscriptions,
  promiseCall,
  promiseCallOn,
  afterFlushPromise,
  login,
  logout,
} from "./imports/app_test_helpers.js";
import chai from "chai";
import {
  HIDE_SOLVED,
  HIDE_SOLVED_METAS,
  STUCK_TO_TOP,
} from "/client/imports/settings.js";
import { waitForDeletion } from "../lib/imports/testutils.js";
import { currentConfirmation } from "./imports/modal.js";

describe("blackboard", function () {
  this.timeout(30000);
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  it("sorts rounds in requested order", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    // there should be table headers for the two rounds, in the right order.
    const civ = Rounds.findOne({ name: "Civilization" });
    chai.assert.isDefined($(`#round${civ._id}`).html());
    const emo = Rounds.findOne({ name: "Emotions and Memories" });
    chai.assert.isDefined($(`#round${emo._id}`).html());
    chai.assert.isBelow(
      $(`#round${civ._id}`).offset().top,
      $(`#round${emo._id}`).offset().top
    );
    $('button[data-sortReverse="true"]').click();
    await afterFlushPromise();
    chai.assert.isAbove(
      $(`#round${civ._id}`).offset().top,
      $(`#round${emo._id}`).offset().top
    );
    $('button[data-sortReverse="false"]').click();
    await afterFlushPromise();
    chai.assert.isBelow(
      $(`#round${civ._id}`).offset().top,
      $(`#round${emo._id}`).offset().top
    );
  });

  it("navigates to puzzle on click", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    const isss = Puzzles.findOne({ name: "Interstellar Spaceship" });
    chai.assert.isOk(isss);
    $(`#m${isss._id} tr.meta a[href^="/puzzles/"]`).trigger(
      $.Event("click", { button: 0 })
    );
    await afterFlushPromise();
    chai.assert.equal(Session.get("currentPage"), "puzzle");
    chai.assert.equal(Session.get("type"), "puzzles");
    chai.assert.equal(Session.get("id"), isss._id);
  });

  it("hides solved", async function () {
    BlackboardPage();
    await waitForSubscriptions();

    const joy = Puzzles.findOne({ name: "Joy" });
    chai.assert.isOk(joy);
    const $joy = $(`#m${joy._id}`);
    const warm = Puzzles.findOne({ name: "Warm And Fuzzy" });
    chai.assert.isOk(warm);
    chai.assert.isOk($joy.find(`tr[data-puzzle-id=\"${warm._id}\"]`)[0]);
    chai.assert.isNotOk($joy.find(".metafooter")[0]);

    await promiseCall("setAnswer", {
      target: warm._id,
      answer: "fleece",
    });
    await afterFlushPromise();
    chai.assert.isOk($joy.find(`tr[data-puzzle-id=\"${warm._id}\"]`)[0]);
    chai.assert.isNotOk($joy.find(".metafooter")[0]);

    HIDE_SOLVED.set(true);
    await afterFlushPromise();
    chai.assert.isNotOk($joy.find(`tr[data-puzzle-id=\"${warm._id}\"]`)[0]);
    chai.assert.isOk($joy.find(".metafooter")[0]);
    chai.assert.equal(
      $joy.find(".metafooter .num-hidden").text(),
      "(1 solved puzzle hidden)"
    );

    await promiseCall("deleteAnswer", { target: warm._id });
    await afterFlushPromise();

    chai.assert.isOk($joy.find(`tr[data-puzzle-id=\"${warm._id}\"]`)[0]);
    chai.assert.isNotOk($joy.find(".metafooter")[0]);

    HIDE_SOLVED.set(false);
  });

  it("hides rounds with no unsolved metas or standalones", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    const round = await promiseCall("newRound", { name: "Hidden" });
    await afterFlushPromise();
    chai.assert.isOk(document.getElementById(`round${round._id}`));

    HIDE_SOLVED_METAS.set(true);
    try {
      await afterFlushPromise();
      chai.assert.isNotOk(document.getElementById(`round${round._id}`));

      const standalone = await promiseCall("newPuzzle", {
        name: "hide solved standalone",
        round: round._id,
      });
      await afterFlushPromise();
      chai.assert.isOk(document.getElementById(`round${round._id}`));

      await promiseCall("setAnswer", {
        target: standalone._id,
        answer: "hitoride",
      });
      await afterFlushPromise();
      chai.assert.isNotOk(document.getElementById(`round${round._id}`));

      const meta = await promiseCall("newPuzzle", {
        name: "hide solved meta",
        round: round._id,
        puzzles: [],
      });
      await promiseCall("newPuzzle", {
        name: "hide solved feeder",
        round: round._id,
        feedsInto: [meta._id],
      });
      await afterFlushPromise();
      chai.assert.isOk(document.getElementById(`round${round._id}`));

      await promiseCall("setAnswer", { target: meta._id, answer: "isshouni" });
      await afterFlushPromise();
      chai.assert.isNotOk(document.getElementById(`round${round._id}`));
    } finally {
      HIDE_SOLVED_METAS.set(false);
    }
  });

  it("renders multiple answers", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    const memoriam = Puzzles.findOne({ name: "In Memoriam" });
    await promiseCall("setAnyField", {
      type: "puzzles",
      object: memoriam._id,
      fields: { answers: ["Bob Hope", "Johnny Cash", "Steve Jobs"] },
    });
    await afterFlushPromise();
    try {
      const answerText = $(`[data-puzzle-id="${memoriam._id}"] .puzzle-answer`)
        .text()
        .trim();
      chai.assert.equal(answerText, "Bob Hope; Johnny Cash; Steve Jobs; ⋯");
    } finally {
      await promiseCall("setAnyField", {
        type: "puzzles",
        object: memoriam._id,
        fields: { answers: null },
      });
    }
  });

  it("renders final answer only", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    const memoriam = Puzzles.findOne({ name: "In Memoriam" });
    await promiseCall("setAnyField", {
      type: "puzzles",
      object: memoriam._id,
      fields: {
        answers: ["Bob Hope", "Johnny Cash", "Steve Jobs"],
        tags: { answer: { value: "Bob Hope; Johnny Cash; Steve Jobs" } },
        solved: 7,
      },
    });
    await afterFlushPromise();
    try {
      const answerText = $(`[data-puzzle-id="${memoriam._id}"] .puzzle-answer`)
        .text()
        .trim();
      chai.assert.equal(answerText, "Bob Hope; Johnny Cash; Steve Jobs");
    } finally {
      await promiseCall("setAnyField", {
        type: "puzzles",
        object: memoriam._id,
        fields: { answers: null, solved: null, tags: null },
      });
    }
  });

  describe("presence filter", function () {
    let other_conn = null;
    let puzz1 = null;
    let puzz2 = null;
    before(async function () {
      puzz1 = Puzzles.findOne({ name: "A Learning Path" });
      puzz2 = Puzzles.findOne({ name: "Unfortunate AI" });
      other_conn = DDP.connect(Meteor.absoluteUrl());
      await promiseCallOn(other_conn, "login", {
        nickname: "incognito",
        real_name: "Mister Snrub",
        password: "failphrase",
      });
      const p1 = new Promise((resolve) =>
        other_conn.subscribe(
          "register-presence",
          `puzzles/${puzz1._id}`,
          "chat",
          { onReady: resolve }
        )
      );
      const p2 = new Promise((resolve) =>
        other_conn.subscribe(
          "register-presence",
          `puzzles/${puzz2._id}`,
          "jitsi",
          { onReady: resolve }
        )
      );
      await Promise.all([p1, p2]);
      BlackboardPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      $(".bb-show-filter-by-user").click();
    });

    afterEach(async function () {
      $(".bb-clear-filter-by-user").click();
      $(".puzzle-working .button-group.open .bb-show-filter-by-user").click();
      await afterFlushPromise();
    });

    function checkPage() {
      chai.assert.isOk($("#searchResults")[0]);
      console.log(`[data-puzzle-id=\"${puzz1._id}\"]`);
      const $puzz1 = $(`[data-puzzle-id=\"${puzz1._id}\"]`);
      chai.assert.equal($puzz1.length, 1);
      chai.assert.equal(
        $puzz1.find('.nick.background[data-nick="incognito"]').length,
        1
      );
      const $puzz2 = $(`[data-puzzle-id=\"${puzz2._id}\"]`);
      chai.assert.equal($puzz2.length, 1);
      chai.assert.equal(
        $puzz2.find('.nick[data-nick="incognito"]:not(.background)').length,
        1
      );
      chai.assert.isNotOk(
        $(`[data-puzzle-id=\"${Puzzles.findOne({ name: "AKA" })}\"]`)[0]
      );
    }

    it("supports typeahead", async function () {
      $(".bb-filter-by-user").val("cogn").trigger("keyup");
      $('li[data-value="incognito"] a').click();
      await afterFlushPromise();
      checkPage();
    });

    it("searches by nickname substring", async function () {
      $(".bb-filter-by-user")
        .val("cogn")
        .trigger(new $.Event("keyup", { keyCode: 13 }));
      await afterFlushPromise();
      checkPage();
    });

    it("searches by name substring", async function () {
      $(".bb-filter-by-user")
        .val("nru")
        .trigger(new $.Event("keyup", { keyCode: 13 }));
      await afterFlushPromise();
      checkPage();
    });

    after(() => other_conn.disconnect());
  });

  describe("prioritize stuck", function () {
    let puzzle;
    let round;
    before(function () {
      STUCK_TO_TOP.set(true);
      round = Rounds.findOne();
    });
    after(function () {
      STUCK_TO_TOP.set(false);
    });
    afterEach(async function () {
      await promiseCall("deletePuzzle", puzzle._id);
    });

    it("shows stuck standalone", async function () {
      STUCK_TO_TOP.set(true);
      BlackboardPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      puzzle = await promiseCall("newPuzzle", {
        name: "stuck standalone",
        round: round._id,
      });
      await promiseCall("summon", { object: puzzle, how: "stuck: test" });
      await afterFlushPromise();
      const $stuck = $("#bb-stuck-puzzles");
      chai.assert.equal($stuck.length, 1, "stuck tbody");
      const $puzzle = $stuck.find(`[data-puzzle-id="${puzzle._id}"]`);
      chai.assert.equal($puzzle.length, 1, "puzzle in tbody");
    });

    it("shows stuck feeding unsolved", async function () {
      const wall_street = Puzzles.findOne({ name: "Wall Street" });
      BlackboardPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      puzzle = await promiseCall("newPuzzle", {
        name: "stuck feeder",
        round: round._id,
        feedsInto: [wall_street._id],
      });
      await promiseCall("summon", { object: puzzle, how: "stuck: test" });
      await afterFlushPromise();
      const $stuck = $("#bb-stuck-puzzles");
      chai.assert.equal(1, $stuck.length, "stuck tbody");
      const $puzzle = $stuck.find(`[data-puzzle-id="${puzzle._id}"]`);
      chai.assert.equal(1, $puzzle.length, "puzzle in tbody");
    });

    describe("feeding solved", function () {
      let wall_street;
      before(async function () {
        wall_street = Puzzles.findOne({ name: "Wall Street" });
        await promiseCall("setAnswer", {
          target: wall_street._id,
          answer: "ceiling",
        });
      });
      after(async function () {
        await promiseCall("deleteAnswer", { target: wall_street._id });
      });
      it("does not show", async function () {
        BlackboardPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        puzzle = await promiseCall("newPuzzle", {
          name: "stuck feeder",
          feedsInto: [wall_street._id],
          round: round._id,
        });
        await promiseCall("summon", { object: puzzle, how: "stuck: test" });
        await afterFlushPromise();
        const $stuck = $("#bb-stuck-puzzles");
        chai.assert.equal($stuck.length, 0, "stcuk tbody");
      });
    });
  });

  describe("in edit mode", function () {
    this.timeout(45000);
    it("allows reordering puzzles", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      const wall_street = Puzzles.findOne({ name: "Wall Street" });
      const maths = Puzzles.findOne({ name: "Advanced Maths" });
      const cheaters = Puzzles.findOne({ name: "Cheaters Never Prosper" });
      const mathsJQ = $(
        `#m${wall_street._id} tr[data-puzzle-id=\"${maths._id}\"]`
      );
      const cheatersJQ = $(
        `#m${wall_street._id} tr[data-puzzle-id=\"${cheaters._id}\"]`
      );
      chai.assert.isBelow(
        mathsJQ.offset().top,
        cheatersJQ.offset().top,
        "before reorder"
      );
      mathsJQ.find("button.bb-move-down").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isAbove(
        mathsJQ.offset().top,
        cheatersJQ.offset().top,
        "after down"
      );
      mathsJQ.find("button.bb-move-up").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isBelow(
        mathsJQ.offset().top,
        cheatersJQ.offset().top,
        "after up"
      );
    });

    it("allows reordering metas", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      const sadness = Puzzles.findOne({ name: "Sadness" });
      const fear = Puzzles.findOne({ name: "Fear" });

      const sadnessJQ = $(`#m${sadness._id} tr.meta`);
      const fearJQ = $(`#m${fear._id} tr.meta`);
      chai.assert.isBelow(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "before reorder"
      );
      sadnessJQ.find("button.bb-move-down").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isAbove(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "after down"
      );
      sadnessJQ.find("button.bb-move-up").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isBelow(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "after up"
      );
      $('button[data-sortreverse="true"]').click();
      await afterFlushPromise();
      chai.assert.isAbove(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "after reverse"
      );
      sadnessJQ.find("button.bb-move-up").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isBelow(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "after up reversed"
      );
      sadnessJQ.find("button.bb-move-down").click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isAbove(
        sadnessJQ.offset().top,
        fearJQ.offset().top,
        "after down reversed"
      );
      $('button[data-sortreverse="false"]').click();
      await afterFlushPromise();
    });

    it("alphabetizes within a meta", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      // there should be a table header for the Civilization round.
      const disgust = Puzzles.findOne({ name: "Disgust" });
      const clueless = Puzzles.findOne({ name: "Clueless" });
      const aka = Puzzles.findOne({ name: "AKA" });
      const disgustJQ = $(`#m${disgust._id}`);
      const cluelessJQ = disgustJQ.find(
        `tr[data-puzzle-id=\"${clueless._id}\"]`
      );
      const akaJQ = disgustJQ.find(`tr[data-puzzle-id=\"${aka._id}\"]`);
      chai.assert.isBelow(
        cluelessJQ.offset().top,
        akaJQ.offset().top,
        "before reorder"
      );
      disgustJQ.find('button[data-sort-order="name"]').click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isAbove(
        cluelessJQ.offset().top,
        akaJQ.offset().top,
        "after alpha"
      );
      disgustJQ.find('button[data-sort-order=""]').click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.isBelow(
        cluelessJQ.offset().top,
        akaJQ.offset().top,
        "after manual"
      );
    });

    it("allows creating and deleting puzzles with buttons", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      $("button.bb-add-round").click();
      await afterFlushPromise();
      const roundInput = $("#bb-new-round input");
      chai.assert.isTrue(roundInput.is(":focus"));
      roundInput.val("Created Round").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(roundInput.parent().hasClass("success"));
      roundInput.focusout();
      await waitForMethods();
      await afterFlushPromise();
      const round = Rounds.findOne({ name: "Created Round" });
      chai.assert.isOk(round, "round");
      $(`#round${round._id} button.bb-add-meta`).click();
      await afterFlushPromise();
      const metaInput = $("#bb-new-puzzle input");
      chai.assert.isTrue(metaInput.is(":focus"));
      metaInput.val("Created Meta").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(metaInput.parent().hasClass("success"));
      metaInput.focusout();
      await waitForMethods();
      await afterFlushPromise();
      const meta = Puzzles.findOne({ name: "Created Meta" });
      chai.assert.isOk(meta, "meta");
      chai.assert.isArray(meta.puzzles);
      $(`#m${meta._id} .bb-meta-buttons .bb-add-puzzle`).click();
      await afterFlushPromise();
      const feederInput = $("#bb-new-puzzle input");
      chai.assert.isTrue(feederInput.is(":focus"));
      feederInput.val("Directly Created").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(feederInput.parent().hasClass("success"));
      feederInput.focusout();
      await waitForMethods();
      await afterFlushPromise();
      const direct = Puzzles.findOne({ name: "Directly Created" });
      chai.assert.isOk(direct, "direct");
      chai.assert.include(direct.feedsInto, meta._id);
      $(`#round${round._id} .bb-add-puzzle`).click();
      await afterFlushPromise();
      const unassignedInput = $("#bb-new-puzzle input");
      chai.assert.isTrue(unassignedInput.is(":focus"));
      unassignedInput.val("Indirectly Created").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(unassignedInput.parent().hasClass("success"));
      unassignedInput.focusout();
      await waitForMethods();
      await afterFlushPromise();
      let indirect = Puzzles.findOne({ name: "Indirectly Created" });
      chai.assert.isOk(indirect, "indirect");
      chai.assert.notInclude(indirect.feedsInto, meta._id);
      $(
        `#unassigned${round._id} tr.puzzle[data-puzzle-id=\"${indirect._id}\"] .bb-feed-meta [data-puzzle-id=\"${meta._id}\"]`
      ).click();
      await waitForMethods();
      await afterFlushPromise();
      indirect = Puzzles.findOne({ name: "Indirectly Created" });
      chai.assert.include(indirect.feedsInto, meta._id);
      const indirectTitle = $(
        `#m${meta._id} tr.puzzle[data-puzzle-id=\"${indirect._id}\"] .bb-puzzle-title`
      );
      indirectTitle.click();
      await afterFlushPromise();
      const indirectInput = indirectTitle.find("input");
      indirectInput.val("Creatively Undirected").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(indirectInput.parent().hasClass("success"));
      indirectInput.focusout();
      await waitForMethods();
      chai.assert.include(Puzzles.findOne(indirect._id), {
        name: "Creatively Undirected",
      });
      const { deleted } = await waitForDeletion(Puzzles, indirect._id);
      $(
        `#m${meta._id} tr.puzzle[data-puzzle-id=\"${indirect._id}\"] .bb-puzzle-title .bb-delete-icon`
      ).click();
      await afterFlushPromise();
      $("#confirmModal .bb-confirm-ok").click();
      await deleted;
      await waitForMethods();
    });

    it("adds and deletes tags", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      const bank = () => Puzzles.findOne({ name: "Letter Bank" });
      const initial = bank();
      chai.assert.notOk(initial.tags.meme);
      const baseJq = $(
        `tbody.meta[data-puzzle-id=\"${initial.feedsInto[1]}\"] [data-puzzle-id=\"${initial._id}\"]`
      );
      baseJq.find("button.bb-add-tag").first().click();
      await afterFlushPromise();
      chai.assert.isTrue(
        baseJq.find(".bb-tag-table .bb-add-tag input").is(":focus")
      );
      const addTagInput = baseJq.find(".bb-tag-table .bb-add-tag input");
      addTagInput.val("Meme").trigger("input");
      await afterFlushPromise();
      chai.assert.isTrue(addTagInput.parent().hasClass("success"));
      addTagInput.focusout();
      await waitForMethods();
      const creation = bank();
      chai.assert.include(creation.tags.meme, {
        name: "Meme",
        value: "",
        touched_by: "testy",
      }, "creation");
      await afterFlushPromise();
      baseJq.find('[data-tag-name="meme"] .bb-edit-tag-value').first().click();
      await afterFlushPromise();
      baseJq
        .find('[data-tag-name="meme"] .bb-edit-tag-value input')
        .first()
        .val("yuno accept deposits?")
        .focusout();
      await waitForMethods();
      let edit = bank();
      chai.assert.include(edit.tags.meme, {
        name: "Meme",
        value: "yuno accept deposits?",
        touched_by: "testy",
      }, "edit on focusout");
      await afterFlushPromise();
      baseJq.find('[data-tag-name="meme"] .bb-edit-tag-value').first().click();
      await afterFlushPromise();
      baseJq
        .find('[data-tag-name="meme"] .bb-edit-tag-value input')
        .first()
        .val("yuno pay interest?")
        .trigger(new $.Event("keydown", { which: 27 }));
      await waitForMethods();
      // no edit on escape
      edit = bank();
      chai.assert.include(edit.tags.meme, {
        name: "Meme",
        value: "yuno accept deposits?",
        touched_by: "testy",
      }, "no edit on escape");
      await afterFlushPromise();
      baseJq.find('[data-tag-name="meme"] .bb-edit-tag-value').first().click();
      await afterFlushPromise();
      baseJq
        .find('[data-tag-name="meme"] .bb-edit-tag-value input')
        .first()
        .val("yuno pay interest?")
        .trigger(new $.Event("keyup", { which: 13 }));
      await waitForMethods();
      // Edit on enter
      edit = bank();
      chai.assert.include(edit.tags.meme, {
        name: "Meme",
        value: "yuno pay interest?",
        touched_by: "testy",
      }, "edit on enter");
      await afterFlushPromise();
      baseJq.find('[data-tag-name="meme"] .bb-edit-tag-value').first().click();
      await afterFlushPromise();
      baseJq
        .find('[data-tag-name="meme"] .bb-edit-tag-value input')
        .first()
        .val("")
        .trigger(new $.Event("keyup", { which: 13 }));
      await waitForMethods();
      // empty cancels
      edit = bank();
      chai.assert.include(edit.tags.meme, {
        name: "Meme",
        value: "yuno pay interest?",
        touched_by: "testy",
      }, "empty cancels");
      await afterFlushPromise();
      baseJq
        .find('[data-tag-name="meme"] .bb-edit-tag-value .bb-delete-icon')
        .first()
        .click();
      const confirmation = currentConfirmation;
      await afterFlushPromise();
      $("#confirmModal .bb-confirm-ok").click();
      await currentConfirmation;
      await waitForMethods();
      const deleted = bank();
      chai.assert.notOk(deleted.tags.meme);
    });

    it("renames tag", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      let disgust = Puzzles.findOne({ name: "Disgust" });
      await promiseCall("setTag", {
        type: "puzzles",
        object: disgust._id,
        name: "color5",
        value: "plurple",
      });
      await afterFlushPromise();
      const tagedit = `[data-puzzle-id=\"${disgust._id}\"] [data-tag-name=\"color5\"] .bb-edit-tag-name`;
      $(tagedit).first().click();
      await afterFlushPromise();
      const colortag = tagedit + " input";
      $(colortag).first().val("Color6").trigger("input");
      await afterFlushPromise();
      chai.assert.equal($(tagedit).attr("class").split(" ").at(-1), "success");
      $(colortag).trigger(new $.Event("keyup", { which: 13 }));
      await waitForMethods();
      disgust = Puzzles.findOne(disgust._id);
      chai.assert.include(disgust.tags.color6, {
        name: "Color6",
        value: "plurple",
      });
      await waitForMethods();
      chai.assert.isNotOk(disgust.tags.color5);
    });

    it("empty name aborts", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      let disgust = Puzzles.findOne({ name: "Disgust" });
      await promiseCall("setTag", {
        type: "puzzles",
        object: disgust._id,
        name: "color3",
        value: "plurple",
      });
      await afterFlushPromise();
      const tagedit = `[data-puzzle-id=\"${disgust._id}\"] [data-tag-name=\"color3\"] .bb-edit-tag-name`;
      $(tagedit).first().click();
      await afterFlushPromise();
      const colortag = tagedit + " input";
      $(colortag).first().val("").trigger("input");
      await afterFlushPromise();
      chai.assert.equal($(tagedit).attr("class").split(" ").at(-1), "error");
      $(colortag).trigger(new $.Event("keyup", { which: 13 }));
      await waitForMethods();
      disgust = Puzzles.findOne(disgust._id);
      chai.assert.isOk(disgust.tags.color3);
    });

    it("will not clobber a tag", async function () {
      EditPage();
      await waitForSubscriptions();
      await afterFlushPromise();
      let disgust = Puzzles.findOne({ name: "Disgust" });
      await promiseCall("setTag", {
        type: "puzzles",
        object: disgust._id,
        name: "color2",
        value: "plurple",
      });
      await afterFlushPromise();
      const tagedit = `[data-puzzle-id=\"${disgust._id}\"] [data-tag-name=\"color2\"] .bb-edit-tag-name`;
      $(tagedit).first().click();
      await afterFlushPromise();
      const colortag = tagedit + " input";
      $(colortag).first().val("color").trigger("input");
      await afterFlushPromise();
      chai.assert.equal($(tagedit).attr("class").split(" ").at(-1), "error");
      $(colortag).trigger(new $.Event("keyup", { which: 13 }));
      await waitForMethods();
      disgust = Puzzles.findOne(disgust._id);
      chai.assert.isOk(disgust.tags.color2);
    });

    describe("partial answers", function () {
      let id;
      beforeEach(async function () {
        const civ = Rounds.findOne({ name: "Civilization" });
        id = (
          await promiseCall("newPuzzle", {
            name: "Multiple Answers",
            round: civ._id,
          })
        )._id;
        await promiseCall("setAnyField", {
          type: "puzzles",
          object: id,
          fields: { answers: ["foo", "bar", "baz", "qux"] },
        });
      });
      afterEach(async function () {
        await promiseCall("deletePuzzle", id);
      });

      it("removes one", async function () {
        EditPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        $(
          `[data-puzzle-id="${id}"] [data-partial-answer="bar"] .bb-delete-icon`
        ).click();
        const confirmation = currentConfirmation;
        await afterFlushPromise();
        $("#confirmModal .bb-confirm-ok").click();
        await confirmation;
        await waitForMethods();
        const puzzle = Puzzles.findOne(id);
        chai.assert.deepEqual(puzzle.answers, ["foo", "baz", "qux"]);
      });

      it("aborts removing one", async function () {
        EditPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        $(
          `[data-puzzle-id="${id}"] [data-partial-answer="bar"] .bb-delete-icon`
        ).click();
        await afterFlushPromise();
        $("#confirmModal .bb-confirm-cancel").click();
        await waitForMethods();

        const puzzle = Puzzles.findOne(id);
        chai.assert.deepEqual(puzzle.answers, ["foo", "bar", "baz", "qux"]);
      });

      it("finalizes", async function () {
        EditPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        $(`[data-puzzle-id="${id}"] .bb-finalize-answers`).click();
        await afterFlushPromise();
        const confirmation = currentConfirmation;
        $("#confirmModal .bb-confirm-ok").click();
        await confirmation;
        await waitForMethods();
        const puzzle = Puzzles.findOne(id);
        chai.assert.equal(puzzle.tags.answer.value, "bar; baz; foo; qux");
      });

      it("aborts finalizing", async function () {
        EditPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        $(`[data-puzzle-id="${id}"] .bb-finalize-answers`).click();
        await afterFlushPromise();
        $("#confirmModal .bb-confirm-cancel").click();
        await waitForMethods();

        const puzzle = Puzzles.findOne(id);
        chai.assert.notOk(puzzle.tags.answer);
      });
    });
  });

  it("makes a puzzle a favorite", async function () {
    BlackboardPage();
    await waitForSubscriptions();
    await afterFlushPromise();
    chai.assert.isUndefined($("#favorites").html());
    // there should be a table header for the Civilization round.
    const granary = Puzzles.findOne({ name: "Granary Of Ur" });
    const bank = Puzzles.findOne({ name: "Letter Bank" });
    chai.assert.isDefined(
      $(
        `#m${granary._id} tr[data-puzzle-id=\"${bank._id}\"] .bb-favorite-button`
      ).html()
    );
    $(
      `#m${granary._id} tr[data-puzzle-id=\"${bank._id}\"] .bb-favorite-button`
    ).click();
    await waitForMethods();
    await waitForSubscriptions();
    await afterFlushPromise();
    chai.assert.isDefined($("#favorites").html());
    chai.assert.isDefined(
      $(`tr[data-puzzle-id=\"${bank._id}\"] .bb-recent-puzzle-chat`).html()
    );
  });
});
