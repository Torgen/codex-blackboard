import {
  CalendarEvents,
  Messages,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import { LogisticsPage } from "/client/imports/router.js";
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
import dragMock from "drag-mock";

describe("logistics", function () {
  this.timeout(10000);
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  describe("callins", function () {
    it("marks puzzle solved", async function () {
      await LogisticsPage();
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
      await LogisticsPage();
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
      await LogisticsPage();
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
      await LogisticsPage();
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
        await LogisticsPage();
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

    describe("when link dropped", function () {
      it("creates round from text", async function () {
        await LogisticsPage();
        await waitForSubscriptions();
        const $newRound = document.querySelector("#bb-logistics-new-round");
        const fakeLink = document.createElement("div");
        fakeLink.ondragstart = function (event) {
          event.dataTransfer.setData(
            "text/uri-list",
            "https://molasses.holiday/foo"
          );
          event.dataTransfer.setData("url", "https://molasses.holiday/foo");
          event.dataTransfer.setData(
            "text/html",
            '<a href="https://molasses.holiday/foo">\n\n   Foo   \n\n </a>'
          );
          event.dataTransfer.effectAllowed = "all";
        };
        dragMock
          .dragStart(fakeLink)
          .dragEnter($newRound)
          .dragOver($newRound)
          .drop($newRound);
        const newRound = await waitForDocument(Rounds, {
          name: "Foo",
        });
        try {
          chai.assert.include(newRound, {
            link: "https://molasses.holiday/foo",
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
        await LogisticsPage();
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

    describe("when link dropped", function () {
      it("creates meta from text", async function () {
        await LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "round for drag and drop",
        });
        try {
          const $newMeta = document.querySelector("#bb-logistics-new-meta");
          const fakeLink = document.createElement("div");
          fakeLink.ondragstart = function (event) {
            event.dataTransfer.setData(
              "text/uri-list",
              "https://molasses.holiday/foo"
            );
            event.dataTransfer.setData("url", "https://molasses.holiday/foo");
            event.dataTransfer.setData(
              "text/html",
              '<a href="https://molasses.holiday/foo">\n\n   Dropped puzzle   \n\n </a>'
            );
            event.dataTransfer.effectAllowed = "all";
          };
          let drag = dragMock.dragStart(fakeLink).dragEnter($newMeta);
          await afterFlushPromise();
          const $round = $(
            `#bb-logistics-new-meta [data-round-id="${round._id}"]`
          ).get(0);
          drag.dragEnter($round).drop($round);
          const newMeta = await waitForDocument(Puzzles, {
            name: "Dropped puzzle",
          });
          try {
            chai.assert.deepInclude(newMeta, {
              link: "https://molasses.holiday/foo",
              puzzles: [],
            });
            chai.assert.include(Rounds.findOne(round._id).puzzles, newMeta._id);
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
        await LogisticsPage();
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

    describe("when link dropped", function () {
      it("creates standalone from text", async function () {
        await LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "round for drag and drop",
        });
        try {
          const $newStandalone = document.querySelector(
            "#bb-logistics-new-standalone"
          );
          const fakeLink = document.createElement("div");
          fakeLink.ondragstart = function (event) {
            event.dataTransfer.setData(
              "text/uri-list",
              "https://molasses.holiday/foo"
            );
            event.dataTransfer.setData("url", "https://molasses.holiday/foo");
            event.dataTransfer.setData(
              "text/html",
              '<a href="https://molasses.holiday/foo">\n\n   Dropped puzzle   \n\n </a>'
            );
            event.dataTransfer.effectAllowed = "all";
          };
          let drag = dragMock.dragStart(fakeLink).dragEnter($newStandalone);
          await afterFlushPromise();
          const $round = $(
            `#bb-logistics-new-standalone [data-round-id="${round._id}"]`
          ).get(0);
          drag.dragEnter($round).drop($round);
          const newStandalone = await waitForDocument(Puzzles, {
            name: "Dropped puzzle",
          });
          try {
            chai.assert.deepInclude(newStandalone, {
              link: "https://molasses.holiday/foo",
            });
            chai.assert.doesNotHaveAnyKeys(newStandalone, ["puzzles"]);
            chai.assert.include(
              Rounds.findOne(round._id).puzzles,
              newStandalone._id
            );
          } finally {
            await promiseCall("deletePuzzle", newStandalone._id);
          }
        } finally {
          await promiseCall("deleteRound", round._id);
        }
      });
    });
  });

  describe("new feeder", function () {
    describe("when clicking button", function () {
      it("creates feeder in meta", async function () {
        await LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "new round for feeder",
        });
        const meta = await promiseCall("newPuzzle", {
          name: "new meta for feeder",
          round: round._id,
          puzzles: [],
        });
        try {
          const $meta = $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
          $meta.find("header .new-puzzle").click();
          await afterFlushPromise();
          const $textbox = $meta.find(".feeders input");
          chai.assert.isTrue($textbox.is(":focus"));
          $textbox
            .val("new feeder in meta")
            .trigger(new $.Event("keyup", { which: 13 }));
          const feeder = await waitForDocument(Puzzles, {
            name: "new feeder in meta",
          });
          try {
            chai.assert.deepInclude(feeder, {
              created_by: "testy",
              feedsInto: [meta._id],
            });
            chai.assert.include(Rounds.findOne(round._id).puzzles, feeder._id);
          } finally {
            await promiseCall("deletePuzzle", feeder._id);
          }
        } finally {
          await promiseCall("deletePuzzle", meta._id);
          await promiseCall("deleteRound", round._id);
        }
      });
    });

    describe("when link dropped", function () {
      it("creates feeder from text", async function () {
        await LogisticsPage();
        await waitForSubscriptions();
        const round = await promiseCall("newRound", {
          name: "round for drag and drop",
        });
        const meta = await promiseCall("newPuzzle", {
          name: "meta for drag and drop",
          round: round._id,
          puzzles: [],
        });
        try {
          const $meta = $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
          const fakeLink = document.createElement("div");
          fakeLink.ondragstart = function (event) {
            event.dataTransfer.setData(
              "text/uri-list",
              "https://molasses.holiday/foo"
            );
            event.dataTransfer.setData("url", "https://molasses.holiday/foo");
            event.dataTransfer.setData(
              "text/html",
              '<a href="https://molasses.holiday/foo">\n\n   Dropped puzzle   \n\n </a>'
            );
            event.dataTransfer.effectAllowed = "all";
          };
          let drag = dragMock
            .dragStart(fakeLink)
            .dragEnter($meta.get(0))
            .dragOver($meta.get(0));
          await afterFlushPromise();
          chai.assert.isOk($meta.find(".puzzle.dragged-link").get(0));
          drag.drop($meta.get(0));
          const newFeeder = await waitForDocument(Puzzles, {
            name: "Dropped puzzle",
          });
          try {
            chai.assert.deepInclude(newFeeder, {
              feedsInto: [meta._id],
              link: "https://molasses.holiday/foo",
            });
            chai.assert.doesNotHaveAnyKeys(newFeeder, ["puzzles"]);
            chai.assert.include(
              Puzzles.findOne(meta._id).puzzles,
              newFeeder._id
            );
            chai.assert.include(
              Rounds.findOne(round._id).puzzles,
              newFeeder._id
            );
          } finally {
            await promiseCall("deletePuzzle", newFeeder._id);
          }
        } finally {
          await promiseCall("deletePuzzle", meta._id);
          await promiseCall("deleteRound", round._id);
        }
      });
    });
  });

  describe("feed meta", function () {
    it("is standalone", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "new meta for feeder",
        round: round._id,
        puzzles: [],
      });
      const standalone = await promiseCall("newPuzzle", {
        name: "standalone to feed meta",
        round: round._id,
      });
      try {
        const $meta = $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
        function getStandalone() {
          return $(
            `.bb-logistics-standalone [href="/puzzles/${standalone._id}"]`
          );
        }
        let drag = dragMock
          .dragStart(getStandalone().get(0))
          .dragOver($(".bb-logistics").get(0))
          .dragEnter($meta.get(0))
          .dragOver($meta.get(0));
        await afterFlushPromise();
        chai.assert.isTrue(
          getStandalone().is(".would-disappear"),
          "would disappear"
        );
        chai.assert.isOk(
          $meta.find(`[href="/puzzles/${standalone._id}"]`),
          "appears in meta"
        );
        chai.assert.notInclude(
          Puzzles.findOne(meta._id).puzzles,
          standalone._id,
          "not in meta yet"
        );
        drag.drop($meta.get(0));
        await waitForMethods();
        await afterFlushPromise();
        chai.assert.include(
          Puzzles.findOne(meta._id).puzzles,
          standalone._id,
          "is in meta"
        );
        chai.assert.isNotOk(getStandalone().get(0), "is not outside meta");
      } finally {
        await promiseCall("deletePuzzle", standalone._id);
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("is meta", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const metameta = await promiseCall("newPuzzle", {
        name: "new metameta for feeder",
        round: round._id,
        puzzles: [],
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta to feed metameta",
        round: round._id,
        puzzles: [],
      });
      try {
        const $metameta = $(
          `.bb-logistics-meta[data-puzzle-id="${metameta._id}"]`
        );
        function getMeta() {
          return $(
            `.bb-logistics-meta[data-puzzle-id="${meta._id}"] header a.meta`
          );
        }
        let drag = dragMock
          .dragStart(getMeta().get(0))
          .dragEnter($metameta.get(0))
          .dragOver($metameta.get(0));
        await afterFlushPromise();
        chai.assert.isFalse(
          getMeta().is(".would-disappear"),
          "would disappear"
        );
        chai.assert.isOk(
          $metameta.find(`[href="/puzzles/${meta._id}"]`),
          "appears in metameta"
        );
        chai.assert.notInclude(
          Puzzles.findOne(metameta._id).puzzles,
          meta._id,
          "not in metameta yet"
        );
        drag.drop($metameta.get(0));
        await waitForMethods();
        await afterFlushPromise();
        chai.assert.include(
          Puzzles.findOne(metameta._id).puzzles,
          meta._id,
          "is in meta"
        );
        chai.assert.isOk(getMeta().get(0), "is still meta");
      } finally {
        await promiseCall("deletePuzzle", metameta._id);
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("feeds another meta", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta1 = await promiseCall("newPuzzle", {
        name: "meta containing feeder",
        round: round._id,
        puzzles: [],
      });
      const meta2 = await promiseCall("newPuzzle", {
        name: "new meta for feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to one meta",
        round: round._id,
        feedsInto: [meta1._id],
      });
      try {
        const $meta1 = $(`.bb-logistics-meta[data-puzzle-id="${meta1._id}"]`);
        const $meta2 = $(`.bb-logistics-meta[data-puzzle-id="${meta2._id}"]`);
        function feederInMeta1() {
          return $meta1.find(`[href="/puzzles/${feeder._id}"]`);
        }
        let drag = dragMock
          .dragStart(feederInMeta1().get(0))
          .dragLeave($meta1.get(0))
          .dragOver($(".bb-logistics").get(0))
          .dragEnter($meta2.get(0));
        await afterFlushPromise();
        chai.assert.isFalse(
          feederInMeta1().is(".would-disappear"),
          "would not disappear"
        );
        chai.assert.isOk(
          $meta2.find(`[href="/puzzles/${feeder._id}"]`),
          "appears in meta2"
        );
        chai.assert.notInclude(
          Puzzles.findOne(meta2._id).puzzles,
          feeder._id,
          "not in meta2 yet"
        );
        drag.drop($meta2.get(0));
        await waitForMethods();
        await afterFlushPromise();
        chai.assert.include(
          Puzzles.findOne(meta2._id).puzzles,
          feeder._id,
          "is in meta2"
        );
        chai.assert.include(
          Puzzles.findOne(meta1._id).puzzles,
          feeder._id,
          "is still in meta1"
        );
      } finally {
        await promiseCall("deletePuzzle", feeder._id);
        await promiseCall("deletePuzzle", meta1._id);
        await promiseCall("deletePuzzle", meta2._id);
        await promiseCall("deleteRound", round._id);
      }
    });
  });

  describe("unfeed meta", function () {
    it("becomes standalone", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta containing feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to one meta",
        round: round._id,
        feedsInto: [meta._id],
      });
      try {
        function getFeeder() {
          return $(`.feeders [href="/puzzles/${feeder._id}"]`);
        }
        function getMeta() {
          return $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
        }
        let drag = dragMock
          .dragStart(getFeeder().get(0))
          .dragEnter(getMeta().get(0));
        await afterFlushPromise();
        chai.assert.isNotOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "before leave"
        );
        chai.assert.isFalse(
          getFeeder().is(".would-disappear"),
          "not blurred yet"
        );
        drag = drag
          .dragLeave(getMeta().get(0))
          .dragOver($(".bb-logistics").get(0));
        await afterFlushPromise();
        chai.assert.isOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "after leave"
        );
        chai.assert.isTrue(
          getFeeder().is(".would-disappear"),
          "would disappear"
        );
        chai.assert.include(
          Puzzles.findOne(meta._id).puzzles,
          feeder._id,
          "not removed yet"
        );
        drag = drag.drop(document.querySelector(".bb-logistics"));
        await waitForMethods();
        chai.assert.isOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "after drop"
        );
        chai.assert.isNotOk(getFeeder().get(0));
        chai.assert.notInclude(
          Puzzles.findOne(meta._id).puzzles,
          feeder._id,
          "removed after drag"
        );
      } finally {
        await promiseCall("deletePuzzle", feeder._id);
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("still feeds another", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta1 = await promiseCall("newPuzzle", {
        name: "meta keeping feeder",
        round: round._id,
        puzzles: [],
      });
      const meta2 = await promiseCall("newPuzzle", {
        name: "meta losing feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to two metas",
        round: round._id,
        feedsInto: [meta1._id, meta2._id],
      });
      try {
        function getMeta2() {
          return $(`.bb-logistics-meta[data-puzzle-id="${meta2._id}"]`);
        }
        function getFeeder() {
          return getMeta2().find(`.feeders [href="/puzzles/${feeder._id}"]`);
        }
        let drag = dragMock
          .dragStart(getFeeder().get(0))
          .dragEnter(getMeta2().get(0));
        await afterFlushPromise();
        chai.assert.isNotOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "before leave"
        );
        chai.assert.isFalse(
          getFeeder().is(".would-disappear"),
          "not blurred yet"
        );
        drag = drag.dragLeave(getMeta2().get(0));
        await afterFlushPromise();
        chai.assert.isNotOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "after leave"
        );
        chai.assert.isTrue(
          getFeeder().is(".would-disappear"),
          "would disappear"
        );
        chai.assert.include(
          Puzzles.findOne(meta2._id).puzzles,
          feeder._id,
          "not removed yet"
        );
        chai.assert.include(
          Puzzles.findOne(meta1._id).puzzles,
          feeder._id,
          "not removed from uninvolved meta"
        );
        drag = drag.drop(document.querySelector(".bb-logistics"));
        await waitForMethods();
        chai.assert.isNotOk(
          $(`.bb-logistics-standalone [href="/puzzles/${feeder._id}"]`).get(0),
          "after drop"
        );
        chai.assert.isNotOk(getFeeder().get(0), "removed from meta2");
        chai.assert.notInclude(
          Puzzles.findOne(meta2._id).puzzles,
          feeder._id,
          "removed after drag"
        );
        chai.assert.include(
          Puzzles.findOne(meta1._id).puzzles,
          feeder._id,
          "never removed from uninvolved meta"
        );
      } finally {
        await promiseCall("deletePuzzle", feeder._id);
        await promiseCall("deletePuzzle", meta1._id);
        await promiseCall("deletePuzzle", meta2._id);
        await promiseCall("deleteRound", round._id);
      }
    });
  });

  describe("edit modal", function () {
    it("closes on escape", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const modalShown = new Promise(function (resolve) {
        $("#bb-logistics-edit-dialog").one("shown", resolve);
      });
      console.log("about to show");
      // jQuery's click() ignores the click handlers and follows the link; the dom method triggers the handlers.
      $(
        `[href="/puzzles/${
          Puzzles.findOne({ name: "Joy" })._id
        }"] .bb-logistics-edit-puzzle`
      )
        .get(0)
        .click();
      await modalShown;
      const modalHidden = new Promise(function (resolve) {
        $("#bb-logistics-edit-dialog").one("hidden", resolve);
      });
      console.log("about to hide");
      $(document).trigger(new $.Event("keydown", { which: 27 }));
      await modalHidden;
    });

    it("closes on backdrop click", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const modalShown = new Promise(function (resolve) {
        $("#bb-logistics-edit-dialog").one("shown", resolve);
      });
      console.log("about to show");
      // jQuery's click() ignores the click handlers and follows the link; the dom method triggers the handlers.
      $(
        `[href="/puzzles/${
          Puzzles.findOne({ name: "Temperance" })._id
        }"] .bb-logistics-edit-puzzle`
      )
        .get(0)
        .click();
      await modalShown;
      const modalHidden = new Promise(function (resolve) {
        $("#bb-logistics-edit-dialog").one("hidden", resolve);
      });
      console.log("about to hide");
      $(".modal-backdrop").click();
      await modalHidden;
    });
  });

  describe("delete button", function () {
    it("deletes feeder", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta containing feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to one meta",
        round: round._id,
        feedsInto: [meta._id],
      });
      try {
        const $deleteButton = $("#bb-logistics-delete");
        function getFeeder() {
          return $(`.feeders a[href="/puzzles/${feeder._id}"]`);
        }
        let drag = dragMock
          .dragStart(getFeeder().get(0))
          .dragEnter($deleteButton.get(0))
          .dragOver($deleteButton.get(0));
        await afterFlushPromise();
        chai.assert.isTrue(getFeeder().is(".would-disappear"));
        drag.drop($deleteButton.get(0));
        await afterFlushPromise();
        $("#confirmModal .bb-confirm-ok").click();
        await waitForMethods();
        try {
          chai.assert.isNotOk(Puzzles.findOne(feeder._id));
          chai.assert.isNotOk(getFeeder().get(0));
        } catch {
          await promiseCall("deletePuzzle", feeder._id);
        }
      } finally {
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("deletes meta", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for standalone",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta containing feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to one meta",
        round: round._id,
        feedsInto: [meta._id],
      });
      try {
        const $deleteButton = $("#bb-logistics-delete");
        function getMeta() {
          return $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
        }
        let drag = dragMock
          .dragStart(getMeta().find("header .meta").get(0))
          .dragEnter($deleteButton.get(0))
          .dragOver($deleteButton.get(0));
        await afterFlushPromise();
        chai.assert.isTrue(getMeta().is(".would-disappear"));
        drag.drop($deleteButton.get(0));
        await afterFlushPromise();
        $("#confirmModal .bb-confirm-ok").click();
        await waitForMethods();
        try {
          chai.assert.isNotOk(Puzzles.findOne(meta._id));
          chai.assert.isOk(Puzzles.findOne(feeder._id));
          chai.assert.isNotOk(getMeta().get(0));
        } catch {
          await promiseCall("deletePuzzle", meta._id);
        }
      } finally {
        await promiseCall("deletePuzzle", feeder._id);
        await promiseCall("deleteRound", round._id);
      }
    });
  });

  describe("calendar events", function () {
    it("assigns to standalone by dragging", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for standalone",
      });
      const standalone = await promiseCall("newPuzzle", {
        name: "standalone to receive event",
        round: round._id,
      });
      const event = await promiseCall("newCalendarEvent", {
        start: Date.now() + 3600000,
        end: Date.now() + 7200000,
        summary: "Event to assign",
      });
      try {
        const $standalone = document.querySelector(
          `.bb-logistics-standalone [href="/puzzles/${standalone._id}"]`
        );
        dragMock
          .dragStart(
            document.querySelector(
              `.bb-calendar-column .bb-calendar-event[data-event-id="${event}"]`
            )
          )
          .dragOver(document.querySelector(".bb-logistics"))
          .dragEnter($standalone)
          .dragOver($standalone)
          .drop($standalone);
        await waitForDocument(CalendarEvents, {
          _id: event,
          puzzle: standalone._id,
        });
      } finally {
        await promiseCall("deleteCalendarEvent", event);
        await promiseCall("deletePuzzle", standalone._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("assigns to meta by dragging", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for meta",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta to receive event",
        round: round._id,
        puzzles: [],
      });
      const event = await promiseCall("newCalendarEvent", {
        start: Date.now() + 3600000,
        end: Date.now() + 7200000,
        summary: "Event to assign",
      });
      try {
        const $meta = $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
        const $metaPuzzle = $meta.find("header .meta");
        dragMock
          .dragStart(
            document.querySelector(
              `.bb-calendar-column .bb-calendar-event[data-event-id="${event}"]`
            )
          )
          .dragOver(document.querySelector(".bb-logistics"))
          .dragEnter($meta.get(0))
          .dragOver($meta.get(0))
          .dragEnter($metaPuzzle.get(0))
          .dragOver($metaPuzzle.get(0))
          .drop($metaPuzzle.get(0));
        await waitForDocument(CalendarEvents, { _id: event, puzzle: meta._id });
      } finally {
        await promiseCall("deleteCalendarEvent", event);
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deleteRound", round._id);
      }
    });

    it("assigns to feeder by dragging", async function () {
      await LogisticsPage();
      await waitForSubscriptions();
      const round = await promiseCall("newRound", {
        name: "new round for feeder",
      });
      const meta = await promiseCall("newPuzzle", {
        name: "meta to receive feeder",
        round: round._id,
        puzzles: [],
      });
      const feeder = await promiseCall("newPuzzle", {
        name: "feeder to receive event",
        round: round._id,
        feedsInto: [meta._id],
      });
      const event = await promiseCall("newCalendarEvent", {
        start: Date.now() + 3600000,
        end: Date.now() + 7200000,
        summary: "Event to assign",
      });
      try {
        const $meta = $(`.bb-logistics-meta[data-puzzle-id="${meta._id}"]`);
        const $feeder = $meta.find(`.feeders [href="/puzzles/${feeder._id}"]`);
        dragMock
          .dragStart(
            document.querySelector(
              `.bb-calendar-column .bb-calendar-event[data-event-id="${event}"]`
            )
          )
          .dragOver(document.querySelector(".bb-logistics"))
          .dragEnter($meta.get(0))
          .dragOver($meta.get(0))
          .dragEnter($feeder.get(0))
          .dragOver($feeder.get(0))
          .drop($feeder.get(0));
        await waitForDocument(CalendarEvents, {
          _id: event,
          puzzle: feeder._id,
        });
      } finally {
        await promiseCall("deleteCalendarEvent", event);
        await promiseCall("deletePuzzle", meta._id);
        await promiseCall("deletePuzzle", feeder._id);
        await promiseCall("deleteRound", round._id);
      }
    });
  });
});
