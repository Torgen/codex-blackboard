import { BlackboardPage, ChatPage, EditPage } from "/client/imports/router.js";
import {
  waitForSubscriptions,
  waitForMethods,
  afterFlushPromise,
  promiseCall,
  login,
  logout,
} from "./imports/app_test_helpers.js";
import { waitForDocument } from "/lib/imports/testutils.js";
import {
  Messages,
  Presence,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import chai from "chai";
import {
  selectWithin,
  selectionWithin,
  textContent,
} from "./imports/contenteditable_selection.js";

describe("chat", function () {
  this.timeout(10000);
  before(async function () {
    ChatPage("general", "0");
    await login("testy", "Teresa Tybalt", "", "failphrase");
    await waitForSubscriptions();
    await afterFlushPromise();
  });

  after(() => logout());

  it("general chat", async function () {
    ChatPage("general", "0");
    await afterFlushPromise();
    await waitForSubscriptions();
    await afterFlushPromise();
    chai.assert.equal($(".bb-chat-presence-block .nick").length, 2, "presence");
    chai.assert.isDefined($('a[href^="https://codexian.us"]').html(), "link");
    chai.assert.isDefined(
      $('img[src^="https://memegen.link/doge"]').html(),
      "meme"
    );
  });

  it("updates read marker", async function () {
    const id = Puzzles.findOne({ name: "Temperance" })._id;
    await promiseCall("newMessage", {
      on_behalf: true,
      room_name: `puzzles/${id}`,
      body: "Something to move the read marker below.",
    });
    ChatPage("puzzles", id);
    await afterFlushPromise();
    await waitForSubscriptions();
    await afterFlushPromise();
    chai.assert.isNotOk($(".bb-message-last-read").offset(), "before");
    $("#messageInput").focus();
    await waitForMethods();
    await afterFlushPromise();
    chai.assert.isOk($(".bb-message-last-read").offset(), "after");
  });

  it("scrolls through history", async function () {
    const id = Puzzles.findOne({ name: "Joy" })._id;
    ChatPage("puzzles", id);
    await waitForSubscriptions();
    await afterFlushPromise();
    const input = $("#messageInput");
    input.prop("innerText", "/me tests actions");
    input.trigger($.Event("keydown", { which: 13 }));
    chai.assert.equal(textContent(input[0]), "", "after first submit");
    await waitForMethods();
    input.prop("innerText", "say another thing");
    input.trigger($.Event("keydown", { which: 13 }));
    chai.assert.equal(textContent(input[0]), "", "after second submit");
    await waitForMethods();
    input.trigger($.Event("keydown", { key: "Up" }));
    chai.assert.equal(
      textContent(input[0]),
      "say another thing",
      "after first up"
    );
    input.trigger($.Event("keydown", { key: "Up" }));
    chai.assert.equal(
      textContent(input[0]),
      "/me tests actions",
      "after second up"
    );
    input.trigger($.Event("keydown", { key: "Up" }));
    chai.assert.equal(
      textContent(input[0]),
      "/me tests actions",
      "after third up"
    );
    input.trigger($.Event("keydown", { key: "Down" }));
    chai.assert.equal(
      textContent(input[0]),
      "/me tests actions",
      "after down with selection at start"
    );
    selectWithin(input[0], input.prop("innerText").length);
    input.trigger($.Event("keydown", { key: "Down" }));
    chai.assert.equal(
      textContent(input[0]),
      "say another thing",
      "after first down"
    );
    input.trigger($.Event("keydown", { key: "Down" }));
    chai.assert.equal(input.prop("innerText"), "", "after second down");
    input.trigger($.Event("keydown", { key: "Down" }));
    chai.assert.equal(input.prop("innerText"), "", "after third down");
  });

  it("loads more", async function () {
    this.timeout(30000);
    const puzz = Puzzles.findOne({ name: "Literary Collection" });
    ChatPage("puzzles", puzz._id);
    const room = `puzzles/${puzz._id}`;
    await waitForSubscriptions();
    await afterFlushPromise();
    for (let _ = 1; _ <= 125; _++) {
      await promiseCall("newMessage", {
        body: "spam",
        room_name: room,
      });
      await promiseCall("newMessage", {
        body: "spams chat",
        action: true,
        room_name: room,
      });
    }
    let allMessages = $("#messages > *");
    chai.assert.isAbove(allMessages.length, 200);
    chai.assert.isBelow(allMessages.length, 250);
    document.querySelector(".bb-chat-load-more").scrollIntoView();
    $(".bb-chat-load-more").click();
    await waitForSubscriptions();
    allMessages = $("#messages > *");
    chai.assert.isAbove(allMessages.length, 250);
  });

  it("deletes message", async function () {
    const puzz = Puzzles.findOne({ name: "Freak Out" });
    ChatPage("puzzles", puzz._id);
    const room = `puzzles/${puzz._id}`;
    await waitForSubscriptions();
    await afterFlushPromise();
    const msg = await promiseCall("newMessage", {
      body: "my social security number is XXX-YY-ZZZZ",
      room_name: room,
    });
    await afterFlushPromise();
    let $badmsg = $(`#messages [data-message-id=\"${msg._id}\"]`);
    chai.assert.isOk($badmsg[0]);
    $badmsg.find(".bb-delete-message").click();
    await afterFlushPromise();
    $(".bb-confirm-ok").click();
    await afterFlushPromise();
    await waitForMethods();
    $badmsg = $(`#messages [data-message-id=\"${msg._id}\"]`);
    chai.assert.isNotOk($badmsg[0]);
    chai.assert.isNotOk(Messages.findOne(msg._id));
  });

  it("aborts deleting message", async function () {
    const puzz = Puzzles.findOne({ name: "Freak Out" });
    ChatPage("puzzles", puzz._id);
    const room = `puzzles/${puzz._id}`;
    await waitForSubscriptions();
    await afterFlushPromise();
    const msg = await promiseCall("newMessage", {
      body: "my social security number is XXX-YY-ZZZZ",
      room_name: room,
    });
    await afterFlushPromise();
    let $badmsg = $(`#messages [data-message-id=\"${msg._id}\"]`);
    chai.assert.isOk($badmsg[0]);
    $badmsg.find(".bb-delete-message").click();
    await afterFlushPromise();
    $(".bb-confirm-cancel").click();
    await afterFlushPromise();
    await waitForMethods();
    $badmsg = $(`#messages [data-message-id=\"${msg._id}\"]`);
    chai.assert.isOk($badmsg[0]);
    chai.assert.isOk(Messages.findOne(msg._id));
  });

  describe("/join", function () {
    it("joins puzzle", async function () {
      const puzz = Puzzles.findOne({ name: "Painted Potsherds" });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/join painted potsherds");
      input.trigger($.Event("keydown", { which: 13 }));
      chai.assert.equal(input.prop("innerText"), "");
      chai.assert.equal(Session.get("type"), "puzzles");
      chai.assert.equal(Session.get("id"), puzz._id);
    });

    it("joins round", async function () {
      const rnd = Rounds.findOne({ name: "Civilization" });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/join civilization");
      input.trigger($.Event("keydown", { which: 13 }));
      chai.assert.equal(input.prop("innerText"), "");
      chai.assert.equal(Session.get("type"), "rounds");
      chai.assert.equal(Session.get("id"), rnd._id);
    });

    it("joins general", async function () {
      const rnd = Rounds.findOne({ name: "Civilization" });
      ChatPage("rounds", rnd._id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/join ringhunters");
      input.trigger($.Event("keydown", { which: 13 }));
      chai.assert.equal(input.prop("innerText"), "");
      chai.assert.equal(Session.get("type"), "general");
      chai.assert.equal(Session.get("id"), 0);
    });

    it("joins puzzle", async function () {
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/join pelvic splanchnic ganglion");
      input.trigger($.Event("keydown", { which: 13 }));
      chai.assert.equal(
        input.prop("innerText"),
        "/join pelvic splanchnic ganglion"
      );
      chai.assert.equal(Session.get("type"), "general");
      chai.assert.equal(Session.get("id"), 0);
      await afterFlushPromise();
      chai.assert.isTrue(input.hasClass("error"));
    });
  });

  describe("typing indicator", function () {
    it("appears when you have text in the box", async function () {
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "ten characters").trigger("input");
      const presence = waitForDocument(Presence, {
        scope: "typing",
        nick: "testy",
      });
    });
  });

  describe("typeahead", function () {
    it("doesn't complete in an empty text area", async function () {
      const id = Puzzles.findOne({ name: "Disgust" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "some innocuous text");
      input.click();
      await afterFlushPromise();
      let typeahead = $("#messageInputTypeahead");
      chai.assert.equal(0, typeahead.length);
      input.trigger($.Event("keydown", { key: "Tab" }));
      await afterFlushPromise();
      typeahead = $("#messageInputTypeahead");
      chai.assert.equal(0, typeahead.length);
    });

    describe("nicks", function () {
      it("accepts keyboard commands", async function () {
        const id = Puzzles.findOne({ name: "Disgust" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "/m a");
        input.click();
        await afterFlushPromise();
        let a = $("#messageInputTypeahead li.active a");
        chai.assert.equal("kwal", a.data("value"), "initial");
        input.trigger($.Event("keydown", { key: "Down" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal("testy", a.data("value"), "one down");
        input.trigger($.Event("keydown", { key: "Up" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal("kwal", a.data("value"), "up after down");
        input.trigger($.Event("keydown", { key: "Up" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal("zachary", a.data("value"), "wraparound up");
        input.trigger($.Event("keydown", { key: "Down" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal("kwal", a.data("value"), "wraparound down");
        input.click();
        await afterFlushPromise();
        chai.assert.equal("kwal", a.data("value"), "no change");
        input.trigger($.Event("keydown", { key: "Tab" }));
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), "/m kwal ");
        chai.assert.deepEqual(selectionWithin(input[0]), [8, 8]);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("allows clicks", async function () {
        const id = Puzzles.findOne({ name: "Space Elevator" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "Yo @es hmu");
        selectWithin(input[0], 4);
        input.click();
        await afterFlushPromise();
        $('a[data-value="testy"]').click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), "Yo @testy  hmu");
        chai.assert.deepEqual(selectionWithin(input[0]), [10, 10]);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("doesn't complete in a private message", async function () {
        const id = Puzzles.findOne({ name: "Disgust" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "/m kwal you hear about @cs");
        selectWithin(input[0], 26);
        input.click();
        await afterFlushPromise();
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("doesn't complete with a selection", async function () {
        const id = Puzzles.findOne({ name: "Disgust" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "/m a");
        selectWithin(input[0], 1, 2);
        input.click();
        await afterFlushPromise();
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });
    });

    describe("rooms", function () {
      it("accepts keyboard commands", async function () {
        const id = Puzzles.findOne({ name: "Disgust" })._id;
        const civ = Rounds.findOne({ name: "Civilization" })._id;
        const recipe = Puzzles.findOne({ name: "Cooking a Recipe" })._id;
        const magic = Puzzles.findOne({
          name: "Sufficiently Advanced Technology",
        })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "prefix #ci");
        input.click();
        await afterFlushPromise();
        let a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`rounds/${civ}`, a.data("value"), "initial");
        input.trigger($.Event("keydown", { key: "Down" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`puzzles/${recipe}`, a.data("value"), "one down");
        input.trigger($.Event("keydown", { key: "Up" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`rounds/${civ}`, a.data("value"), "up after down");
        input.trigger($.Event("keydown", { key: "Up" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`puzzles/${magic}`, a.data("value"), "wraparound up");
        input.trigger($.Event("keydown", { key: "Down" }));
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`rounds/${civ}`, a.data("value"), "wraparound down");
        input.click();
        await afterFlushPromise();
        a = $("#messageInputTypeahead li.active a");
        chai.assert.equal(`rounds/${civ}`, a.data("value"), "no change");
        input.trigger($.Event("keydown", { key: "Tab" }));
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `prefix #rounds/${civ} `);
        chai.assert.deepEqual(selectionWithin(input[0]), [33, 33]);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("allows clicks", async function () {
        const id = Puzzles.findOne({ name: "Space Elevator" })._id;
        const recipe = Puzzles.findOne({ name: "Cooking a Recipe" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "Yo #ci hmu");
        selectWithin(input[0], 4);
        input.click();
        await afterFlushPromise();
        $(`a[data-value="puzzles/${recipe}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `Yo #puzzles/${recipe}  hmu`);
        chai.assert.deepEqual(selectionWithin(input[0]), [30, 30]);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("completes room id", async function () {
        const id = Puzzles.findOne({ name: "Space Elevator" })._id;
        const recipe = Puzzles.findOne({ name: "Cooking a Recipe" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", `#puzzles/${recipe.substr(0, 12)}`);
        input.click();
        await afterFlushPromise();
        $(`a[data-value="puzzles/${recipe}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `#puzzles/${recipe} `);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("completes puzzle room id", async function () {
        const id = Puzzles.findOne({ name: "Space Elevator" })._id;
        const recipe = Puzzles.findOne({ name: "Cooking a Recipe" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "#puzzles/Cook");
        input.click();
        await afterFlushPromise();
        $(`a[data-value="puzzles/${recipe}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `#puzzles/${recipe} `);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("doesn't need hash for puzzles", async function () {
        const id = Puzzles.findOne({ name: "Space Elevator" })._id;
        const recipe = Puzzles.findOne({ name: "Cooking a Recipe" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "#Cook");
        input.click();
        await afterFlushPromise();
        $(`a[data-value="puzzles/${recipe}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `#puzzles/${recipe} `);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("completes round room id", async function () {
        const id = Rounds.findOne({ name: "Civilization" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "#rounds/ivil");
        input.click();
        await afterFlushPromise();
        $(`a[data-value="rounds/${id}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `#rounds/${id} `);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });

      it("doesn't need hash for rounds", async function () {
        const id = Rounds.findOne({ name: "Civilization" })._id;
        ChatPage("puzzles", id);
        await waitForSubscriptions();
        await afterFlushPromise();
        const input = $("#messageInput");
        input.prop("innerText", "#ivil");
        input.click();
        await afterFlushPromise();
        $(`a[data-value="rounds/${id}"]`).click();
        await afterFlushPromise();
        chai.assert.equal(textContent(input[0]), `#rounds/${id} `);
        const typeahead = $("#messageInputTypeahead");
        chai.assert.equal(0, typeahead.length);
      });
    });
  });

  describe("submit", function () {
    it("mentions", async function () {
      const id = Puzzles.findOne({ name: "Showcase" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "@kwal you hear about @Cscott?");
      input.trigger($.Event("keydown", { which: 13 }));
      await waitForMethods();
      await afterFlushPromise();
      const msg = Messages.findOne(
        { nick: "testy", room_name: `puzzles/${id}` },
        { sort: { timestamp: -1 } }
      );
      chai.assert.deepInclude(msg, { mention: ["kwal", "cscott"] });
    });

    it("nonexistent mentions", async function () {
      const id = Puzzles.findOne({ name: "Soooo Cute!" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "@kwal exists but @flibby does not");
      input.trigger($.Event("keydown", { which: 13 }));
      await waitForMethods();
      await afterFlushPromise();
      const msg = Messages.findOne(
        { nick: "testy", room_name: `puzzles/${id}` },
        { sort: { timestamp: -1 } }
      );
      chai.assert.deepEqual(msg.mention, ["kwal"]);
    });

    it("action", async function () {
      const id = Puzzles.findOne({ name: "This SHOULD Be Easy" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/me heard about @Cscott");
      input.trigger($.Event("keydown", { which: 13 }));
      await waitForMethods();
      await afterFlushPromise();
      const msg = Messages.findOne(
        { nick: "testy", room_name: `puzzles/${id}` },
        { sort: { timestamp: -1 } }
      );
      chai.assert.deepInclude(msg, {
        action: true,
        mention: ["cscott"],
        body: "heard about @Cscott",
      });
    });

    it("messages", async function () {
      const id = Puzzles.findOne({ name: "Charm School" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/msg kwal you hear about @Cscott?");
      input.trigger($.Event("keydown", { which: 13 }));
      await waitForMethods();
      await afterFlushPromise();
      const msg = Messages.findOne(
        { nick: "testy", room_name: `puzzles/${id}` },
        { sort: { timestamp: -1 } }
      );
      chai.assert.deepInclude(msg, { to: "kwal" });
      chai.assert.isNotOk(msg.mention);
    });

    it("errors on message to nobody", async function () {
      const id = Puzzles.findOne({ name: "Charm School" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const input = $("#messageInput");
      input.prop("innerText", "/msg cromslor you hear about @Cscott?");
      input.trigger($.Event("keydown", { which: 13 }));
      chai.assert.equal(
        input.prop("innerText"),
        "/msg cromslor you hear about @Cscott?"
      );
      await afterFlushPromise();
      chai.assert.isTrue(input.hasClass("error"));
    });
  });

  describe("room mentions", function () {
    describe("when puzzle is solved", function () {
      let cs;
      let msg;
      before(async function () {
        cs = Puzzles.findOne({ name: "Charm School" })._id;
        await promiseCall("setAnswer", { target: cs, answer: "choose one" });
        msg = await promiseCall("newMessage", {
          body: `mention of #puzzles/${cs}`,
          room_name: "general/0",
        });
      });
      it("shows that", async function () {
        ChatPage("general", "0");
        await waitForSubscriptions();
        await afterFlushPromise();
        const $mention = $(
          `#messages [data-message-id="${msg._id}"] .bb-room-mention`
        );
        chai.assert.isTrue($mention.hasClass("solved"));
        chai.assert.isNotEmpty($mention.find(".fa-puzzle-piece").get());
        chai.assert.equal(
          $mention.contents().not($mention.children()).text().trim(),
          "Charm School"
        );
      });
      after(async function () {
        await promiseCall("deleteAnswer", { target: cs });
      });
    });
    describe("when puzzle is stuck", function () {
      let cs;
      let msg;
      before(async function () {
        cs = Puzzles.findOne({ name: "Charm School" })._id;
        await promiseCall("summon", { object: cs, how: "choose one" });
        msg = await promiseCall("newMessage", {
          body: `mention of #puzzles/${cs}`,
          room_name: "general/0",
        });
      });
      it("shows that", async function () {
        ChatPage("general", "0");
        await waitForSubscriptions();
        await afterFlushPromise();
        const $mention = $(
          `#messages [data-message-id="${msg._id}"] .bb-room-mention`
        );
        chai.assert.isTrue($mention.hasClass("stuck"));
        chai.assert.isNotEmpty($mention.find(".fa-puzzle-piece").get());
        chai.assert.equal(
          $mention.contents().not($mention.children()).text().trim(),
          "Charm School"
        );
      });
      after(async function () {
        await promiseCall("unsummon", { object: cs });
      });
    });
    it("shows that puzzle does not exist", async function () {
      const msg = await promiseCall("newMessage", {
        body: "mention of #puzzles/asdfasdf",
        room_name: "general/0",
      });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const $mention = $(
        `#messages [data-message-id="${msg._id}"] .bb-room-mention`
      );
      chai.assert.isTrue($mention.hasClass("nonexistent"));
      chai.assert.isNotEmpty($mention.find(".fa-puzzle-piece").get());
      chai.assert.equal(
        $mention.contents().not($mention.children()).text().trim(),
        "puzzle does not exist"
      );
    });
    it("shows round that exists", async function () {
      const civ = Rounds.findOne({ name: "Civilization" })._id;
      const msg = await promiseCall("newMessage", {
        body: `mention of #rounds/${civ}`,
        room_name: "general/0",
      });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const $mention = $(
        `#messages [data-message-id="${msg._id}"] .bb-room-mention`
      );
      chai.assert.isNotEmpty($mention.find(".fa-globe").get());
      chai.assert.equal(
        $mention.contents().not($mention.children()).text().trim(),
        "Civilization"
      );
    });
    it("shows that round does not exist", async function () {
      const msg = await promiseCall("newMessage", {
        body: "mention of #rounds/asdfasdf",
        room_name: "general/0",
      });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const $mention = $(
        `#messages [data-message-id="${msg._id}"] .bb-room-mention`
      );
      chai.assert.isTrue($mention.hasClass("nonexistent"));
      chai.assert.isNotEmpty($mention.find(".fa-globe").get());
      chai.assert.equal(
        $mention.contents().not($mention.children()).text().trim(),
        "round does not exist"
      );
    });
    it("links to top for general", async function () {
      const msg = await promiseCall("newMessage", {
        body: "mention of #general/0",
        room_name: "general/0",
      });
      ChatPage("general", "0");
      await waitForSubscriptions();
      await afterFlushPromise();
      const $mention = $(
        `#messages [data-message-id="${msg._id}"] .bb-room-mention`
      );
      chai.assert.equal(
        $mention.contents().not($mention.children()).text().trim(),
        "Ringhunters"
      );
    });
  });

  describe("polls", () =>
    it("lets you change your vote", async function () {
      const id = Puzzles.findOne({ name: "Amateur Hour" })._id;
      ChatPage("puzzles", id);
      await waitForSubscriptions();
      await afterFlushPromise();
      const poll = await promiseCall(
        "newPoll",
        `puzzles/${id}`,
        "Flip a coin",
        ["heads", "tails"]
      );
      await afterFlushPromise();
      await waitForSubscriptions(); // when the message with the poll renders, the subscription to the poll also happens.
      await afterFlushPromise();
      const results = $("#messages td.results .bar");
      chai.assert.equal(results.length, 2);
      chai.assert.equal(results[0].style.width, "0%");
      chai.assert.equal(results[1].style.width, "0%");
      await promiseCall("setAnyField", {
        type: "polls",
        object: poll,
        fields: {
          votes: {
            cscott: {
              canon: "heads",
              timestamp: 1,
            },
            kwal: {
              canon: "tails",
              timestamp: 2,
            },
            zachary: {
              canon: "heads",
              timestamp: 3,
            },
          },
        },
      });
      await afterFlushPromise();
      chai.assert.equal(results[0].style.width, "100%");
      chai.assert.equal(results[1].style.width, "50%");
      $('button[data-option="tails"]').click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.equal(results[0].style.width, "100%");
      chai.assert.equal(results[1].style.width, "100%");
      $('button[data-option="heads"]').click();
      await waitForMethods();
      await afterFlushPromise();
      chai.assert.equal(results[0].style.width, "100%");
      chai.assert.equal(results[1].style.width, "33.3333%");
    }));

  describe("starred messages", function () {
    describe("unstarred message in chat", function () {
      let id;
      before(async function () {
        const msg = await promiseCall("newMessage", {
          body: "Let's find the coin!",
          room_name: "general/0",
        });
        id = msg._id;
      });

      it("can be starred", async function () {
        ChatPage("general", "0");
        await waitForSubscriptions();
        await afterFlushPromise();
        const $msg = $(`#messages [data-message-id="${id}"]`);
        chai.assert.isOk($msg.get(0));
        $msg.find(".bb-message-star").click();
        await waitForMethods();
        chai.assert.isTrue(Messages.findOne(id).starred);
      });
    });

    describe("starred message in blackboard", function () {
      this.timeout(30000);
      let id;
      before(async function () {
        const msg = await promiseCall("newMessage", {
          body: "Let's find the coin!",
          room_name: "general/0",
        });
        id = msg._id;
        await promiseCall("setStarred", id, true);
      });

      it("cannot be unstarred", async function () {
        BlackboardPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        const $msg = $(`.bb-starred-messages [data-message-id="${id}"]`);
        chai.assert.isOk($msg.get(0));
        $msg.find(".bb-message-star").click();
        await waitForMethods();
        chai.assert.isTrue(Messages.findOne(id).starred);
      });
    });

    describe("starred message in edit mode", function () {
      this.timeout(30000);
      let id;
      before(async function () {
        const msg = await promiseCall("newMessage", {
          body: "Let's find the coin!",
          room_name: "general/0",
        });
        id = msg._id;
        await promiseCall("setStarred", id, true);
      });

      it("can be unstarred", async function () {
        EditPage();
        await waitForSubscriptions();
        await afterFlushPromise();
        const $msg = $(`.bb-starred-messages [data-message-id="${id}"]`);
        chai.assert.isOk($msg.get(0));
        $msg.find(".bb-message-star").click();
        await waitForMethods();
        chai.assert.isNotOk(Messages.findOne(id).starred);
      });
    });
  });
});
