import { CallIns, Puzzles } from "/lib/imports/collections.js";
import { PuzzlePage } from "/client/imports/router.js";
import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  promiseCall,
  login,
  logout,
} from "./imports/app_test_helpers.js";
import chai from "chai";

function modalHiddenPromise() {
  return new Promise((resolve) => $("#callin_modal").one("hidden", resolve));
}

describe("puzzle", function () {
  before(async function () {
    this.timeout(30000);
    await login("testy", "Teresa Tybalt", "", "failphrase");
    await waitForSubscriptions();
  });

  after(() => logout());

  describe("metameta", function () {
    this.timeout(10000);
    let id = null;
    beforeEach(async function () {
      id = Puzzles.findOne({ name: "Interstellar Spaceship" })._id;
    });

    it("renders puzzle view", async function () {
      PuzzlePage(id, "puzzle");
      await afterFlushPromise();
      await waitForSubscriptions();
      await afterFlushPromise();
    });

    describe("in info view", function () {
      beforeEach(async function () {
        PuzzlePage(id, "info");
        await afterFlushPromise();
        await waitForSubscriptions();
        await afterFlushPromise();
      });

      it("allows modifying feeders", async function () {
        $(".unattached").click();
        await afterFlushPromise();
        const storm = Puzzles.findOne({ name: "The Brainstorm" });
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        await afterFlushPromise();
        chai.assert.include(Puzzles.findOne(id).puzzles, storm._id);
        $(`[data-feeder-id=\"${storm._id}\"] input`).click();
        await waitForMethods();
        await afterFlushPromise();
        chai.assert.notInclude(Puzzles.findOne(id).puzzles, storm._id);
      });

      return it("allows spilling grandfeeders", async function () {
        $(".grandfeeders").click();
        await afterFlushPromise();
        const doors = Puzzles.findOne({ name: "The Doors Of Cambridge" });
        chai.assert.lengthOf($(`[data-feeder-id=\"${doors._id}\"]`).get(), 3);
      });
    });
  });

  describe("meta", function () {
    this.timeout(10000);
    let id = null;
    beforeEach(async function () {
      id = Puzzles.findOne({ name: "Anger" })._id;
    });

    it("renders puzzle view", async function () {
      PuzzlePage(id, "puzzle");
      await waitForSubscriptions();
      await afterFlushPromise();
    });

    describe("in info view", function () {
      beforeEach(async function () {
        PuzzlePage(id, "info");
        await waitForSubscriptions();
        await afterFlushPromise();
      });

      it("has no grandfeeders button", function () {
        chai.assert.isNotOk($(".grandfeeders")[0]);
      });

      it("has feeders in order", function () {
        chai.assert.deepEqual(
          $(".bb-round-answers tr[data-feeder-id]")
            .map(function () {
              return this.dataset.feederId;
            })
            .get(),
          Puzzles.findOne(id).puzzles
        );
      });

      describe("when unattached is checked", function () {
        before(async function () {
          $(".unattached:not(.active)").click();
          await afterFlushPromise();
        });
        it("allows modifying feeders", async function () {
          const storm = Puzzles.findOne({ name: "The Brainstorm" });
          $(`[data-feeder-id=\"${storm._id}\"] input`).click();
          await waitForMethods();
          chai.assert.include(Puzzles.findOne(id).puzzles, storm._id);
          $(`[data-feeder-id=\"${storm._id}\"] input`).click();
          await waitForMethods();
          chai.assert.notInclude(Puzzles.findOne(id).puzzles, storm._id);
        });
        after(async function () {
          $(".unattached.active").click();
          await afterFlushPromise();
        });
      });

      describe("when order_by is name", function () {
        before(async function () {
          await promiseCall("setField", {
            type: "puzzles",
            object: id,
            fields: { order_by: "name" },
          });
          await afterFlushPromise();
        });

        it("renders them in alphabetical order", async function () {
          chai.assert.deepEqual(
            $(".bb-round-answers tr[data-feeder-id] td:first-child")
              .map(function () {
                return this.innerText;
              })
              .get(),
            [
              "Asteroids",
              "Birds of a Feather",
              "Chemistry Experimentation",
              "Cross Words",
              "Irritating Places",
              "Let's Get Ready To Jumble",
              "Roadside America",
              "Scattered and Absurd",
              "Temperance",
              "That Time I Somehow Felt Incomplete",
              "What's In a Name?",
              "Yeah, But It Didn't Work!",
            ]
          );
        });

        after(async function () {
          await promiseCall("setField", {
            type: "puzzles",
            object: id,
            fields: { order_by: "" },
          });
          await afterFlushPromise();
        });
      });

      it("renders multiple answers", async function () {
        const asteroids = Puzzles.findOne({ name: "Asteroids" });
        await promiseCall("setAnyField", {
          type: "puzzles",
          object: asteroids._id,
          fields: { answers: ["ceres", "hathor", "pallas"] },
        });
        try {
          await afterFlushPromise();
          const answerText = $(
            `[data-feeder-id="${asteroids._id}"] .answer`
          ).text();
          chai.assert.include(answerText, "ceres; hathor; pallas; ⋯");
        } finally {
          await promiseCall("setAnyField", {
            type: "puzzles",
            object: asteroids._id,
            fields: { answer: null },
          });
        }
      });
    });
  });

  describe("leaf", function () {
    this.timeout(10000);
    let id = null;
    beforeEach(async function () {
      id = Puzzles.findOne({ name: "Cross Words" })._id;
    });

    it("renders puzzle view", async function () {
      PuzzlePage(id, "puzzle");
      await waitForSubscriptions();
      await afterFlushPromise();
    });

    return it("renders info view", async function () {
      PuzzlePage(id, "info");
      await waitForSubscriptions();
      await afterFlushPromise();
    });
  });

  describe("callin modal", function () {
    this.timeout(10000);
    let id = null;
    let callin = null;
    beforeEach(async function () {
      id = Puzzles.findOne({ name: "Cross Words" })._id;
      PuzzlePage(id, "puzzle");
      await waitForSubscriptions();
      await afterFlushPromise();
    });

    afterEach(async function () {
      if (!callin) {
        return;
      }
      await promiseCall("cancelCallIn", { id: callin._id });
      callin = null;
    });

    it("creates answer callin", async function () {
      $(".bb-callin-btn").click();
      $(".bb-callin-answer").val("grrr");
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrr",
        callin_type: "answer",
        created_by: "testy",
        backsolve: false,
        provided: false,
      });
    });

    it("creates partial answer callin", async function () {
      $(".bb-callin-btn").click();
      $(".bb-callin-answer").val("grrr");
      $('input[value="partial answer"]').prop("checked", true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrr",
        callin_type: "partial answer",
        created_by: "testy",
        backsolve: false,
        provided: false,
      });
    });

    it("creates backsolve callin", async function () {
      $(".bb-callin-btn").click();
      await afterFlushPromise();
      $(".bb-callin-answer").val("grrrr");
      $('input[value="backsolve"]').prop("checked", true);
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrrr",
        callin_type: "answer",
        created_by: "testy",
        backsolve: true,
        provided: false,
      });
    });

    it("creates provided callin", async function () {
      $(".bb-callin-btn").click();
      await afterFlushPromise();
      $(".bb-callin-answer").val("grrrrr");
      $('input[value="provided"]').prop("checked", true);
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrrrr",
        callin_type: "answer",
        created_by: "testy",
        backsolve: false,
        provided: true,
      });
    });

    it("creates expected callback callin", async function () {
      $(".bb-callin-btn").click();
      $(".bb-callin-answer").val("grrrrrr");
      $('input[value="expected callback"]').prop("checked", true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrrrrr",
        callin_type: "expected callback",
        created_by: "testy",
        backsolve: false,
        provided: false,
      });
    });

    it("creates message to hq callin", async function () {
      $(".bb-callin-btn").click();
      $(".bb-callin-answer").val("grrrrrrr");
      $('input[value="message to hq"]').prop("checked", true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrrrrrr",
        callin_type: "message to hq",
        created_by: "testy",
        backsolve: false,
        provided: false,
      });
    });

    it("creates interaction request callin", async function () {
      $(".bb-callin-btn").click();
      $(".bb-callin-answer").val("grrrrrrrr");
      $('input[value="interaction request"]').prop("checked", true).change();
      await afterFlushPromise();
      const p = modalHiddenPromise();
      $(".bb-callin-submit").click();
      await p;
      await waitForMethods();
      callin = CallIns.findOne({ target: id, status: "pending" });
      chai.assert.deepInclude(callin, {
        answer: "grrrrrrrr",
        callin_type: "interaction request",
        created_by: "testy",
        backsolve: false,
        provided: false,
      });
    });

    it("defaults to partial answer when there are already multiple answers", async function () {
      await promiseCall("setAnyField", {
        type: "puzzles",
        object: id,
        fields: { answers: ["argh", "booga"] },
      });
      await afterFlushPromise();
      try {
        $(".bb-callin-btn").click();
        await afterFlushPromise();
        chai.assert.isTrue($('input[value="partial answer"]').prop("checked"));
      } finally {
        const p = modalHiddenPromise();
        $('[data-dismiss="modal"]').click();
        await p;
        await promiseCall("setAnyField", {
          type: "puzzles",
          object: id,
          fields: { answers: null },
        });
      }
    });
  });
});
