import {
  waitForMethods,
  waitForSubscriptions,
  afterFlushPromise,
  login,
  logout,
} from "./imports/app_test_helpers.js";
import chai from "chai";
import delay from "delay";

function waitForLogin() {
  return new Promise((resolve) => {
    Tracker.autorun((computation) => {
      if (!Meteor.user()) {
        return;
      }
      computation.stop();
      resolve();
    });
  });
}

function waitForNotLoggingIn() {
  return new Promise((resolve) => {
    Tracker.autorun((computation) => {
      if (Meteor.loggingIn()) {
        return;
      }
      computation.stop();
      resolve();
    });
  });
}

describe("login", function () {
  this.timeout(20000);
  it("only sends email hash", async function () {
    await login("testy", "Teresa Tybalt", "fake@artifici.al", "failphrase");
    await waitForSubscriptions();
    chai.assert.isUndefined(Meteor.users.findOne("testy").gravatar);
    chai.assert.equal(
      Meteor.users.findOne("testy").gravatar_md5,
      "a24f643d34150c3b4053989db38251c9"
    );
  });

  it("requires matching password", async function () {
    try {
      await login(
        "testy",
        "Teresa Tybalt",
        "fake@artifici.al",
        "succeedphoneme"
      );
    } catch (e) {
      chai.assert.deepEqual(e.details, { field: "password" });
      return;
    }
    chai.assert.fail();
  });

  describe("through UI", function () {
    it("updates typeahead and gravatar", async function () {
      // If this test case is run in isolation, ensure there's an entry. Intentionally different email.
      await login("testy", "Teresa Tybalt", "testy@example.com", "failphrase");
      await logout();
      await waitForSubscriptions();
      $("#passwordInput").val("failphrase");
      $("#nickInput").focus().val("tes").trigger("keyup").trigger("input");
      await afterFlushPromise();
      chai.assert.equal(
        $('[for="nickEmail"] .gravatar img').attr("src"),
        "https://secure.gravatar.com/avatar/2c05cf2e37d5526ed477ac2d8d5ddcba.jpg?d=wavatar&s=80"
      );
      $('#nickInput + .typeahead li[data-value="testy"]').click();
      await afterFlushPromise();
      chai.assert.equal($("#nickInput").val(), "testy");
      chai.assert.equal($("#nickEmail").val(), "");
      chai.assert.equal(
        $('[for="nickEmail"] .gravatar img').attr("src"),
        "https://secure.gravatar.com/avatar/05c1de2f5c5e7933bee97a499e818c5e.jpg?d=wavatar&s=80"
      );
      $("#nickEmail").val("fake@artifici.al").trigger("input");
      // debounce -- won't change yet.
      chai.assert.equal(
        $('[for="nickEmail"] .gravatar img').attr("src"),
        "https://secure.gravatar.com/avatar/05c1de2f5c5e7933bee97a499e818c5e.jpg?d=wavatar&s=80"
      );
      await delay(500);
      await afterFlushPromise();
      chai.assert.equal(
        $('[for="nickEmail"] .gravatar img').attr("src"),
        "https://secure.gravatar.com/avatar/a24f643d34150c3b4053989db38251c9.jpg?d=wavatar&s=80"
      );
      $(".bb-submit").click();
      await waitForLogin();
      chai.assert.equal(
        Meteor.user().gravatar_md5,
        "a24f643d34150c3b4053989db38251c9"
      );
    });

    it("highlights password field when wrong", async function () {
      $("#passwordInput").val("succeedphoneme");
      $("#nickInput").val("testy").trigger("input");
      await afterFlushPromise();
      chai.assert.isOk($(".bb-submit")[0]);
      $(".bb-submit").click();
      await waitForNotLoggingIn();
      await afterFlushPromise();
      chai.assert.isNotOk(Meteor.userId());
      chai.assert.isTrue(
        $("#passwordInputGroup")[0].classList.contains("error")
      );
      chai.assert.equal($("#loginError")[0].innerText, "Wrong password");
    });

    it("highlights nick field when too long", async function () {
      $("#passwordInput").val("failphrase");
      $("#nickInput").val("thisisovertwentycharacterslong").trigger("input");
      await afterFlushPromise();
      chai.assert.isOk($(".bb-submit")[0]);
      $(".bb-submit").click();
      await waitForNotLoggingIn();
      await afterFlushPromise();
      chai.assert.isNotOk(Meteor.userId());
      chai.assert.isTrue($("#nickInputGroup")[0].classList.contains("error"));
      chai.assert.equal(
        $("#loginError")[0].innerText,
        "Nickname must be 1-20 characters long"
      );
    });

    it("highlights nick field when matches bot", async function () {
      $("#passwordInput").val("failphrase");
      $("#nickInput").val("codexbot").trigger("input");
      await afterFlushPromise();
      chai.assert.isOk($(".bb-submit")[0]);
      $(".bb-submit").click();
      await waitForNotLoggingIn();
      await afterFlushPromise();
      chai.assert.isNotOk(Meteor.userId());
      chai.assert.isTrue($("#nickInputGroup")[0].classList.contains("error"));
      chai.assert.equal(
        $("#loginError")[0].innerText,
        "Can't impersonate the bot"
      );
    });

    it("logs in", async function () {
      $("#passwordInput").val("failphrase");
      $("#nickInput").val("testy").trigger("input");
      await afterFlushPromise();
      chai.assert.isOk($(".bb-submit")[0]);
      $(".bb-submit").click();
      await waitForLogin();
      chai.assert.equal(Meteor.userId(), "testy");
    });
  });

  afterEach(() => logout());
});
