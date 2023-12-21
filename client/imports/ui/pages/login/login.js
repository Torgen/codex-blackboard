import "./login.html";
import md5 from "md5";
import canonical from "/lib/imports/canonical.js";
import loginWithCodex from "/client/imports/accounts.js";
import { hashFromNickObject } from "/lib/imports/nickEmail.js";

Template.login.onCreated(function () {
  this.suppressRender = new ReactiveVar(Meteor.loggingIn());
  this.autorun(() => {
    if (!Meteor.loggingIn()) {
      return this.suppressRender.set(false);
    }
  });
  this.gravatarHash = new ReactiveVar(md5(""));
  // we'd need to subscribe to 'all-nicks' here if we didn't have a permanent
  // subscription to it (in main.coffee)
  this.updateGravatar = (q) => {
    if ($("#nickEmail").val()) {
      this.gravatarHash.set(md5($("#nickEmail").val()));
      return;
    }
    const nick = $("#nickInput").val() ?? "";
    if (q == null) {
      q = { _id: canonical(nick) };
    }
    return this.gravatarHash.set(hashFromNickObject(q));
  };
  this.update = (query, options) => {
    // can we find an existing nick matching this?
    const n = query ? Meteor.users.findOne(canonical(query)) : undefined;
    if (n || options?.force) {
      const realname = n?.real_name;
      $("#nickRealname").val(realname || "");
      $("#nickEmail").val("");
    }
    this.updateGravatar(n);
  };
  this.typeaheadSource = (query, process) => {
    this.update(query);
    return Meteor.users
      .find({ bot_wakeup: { $exists: false } })
      .fetch()
      .map((n) => n.nickname);
  };
});
const nickInput = new Tracker.Dependency();
Template.login.helpers({
  suppressRender() {
    return Template.instance().suppressRender.get();
  },
  disabled() {
    nickInput.depend();
    return Meteor.loggingIn() || !$("#nickInput").val();
  },
  hash() {
    return Template.instance().gravatarHash.get();
  },
});
Template.login.onRendered(function () {
  $("#nickSuccess").val("false");
  $("#nickPickModal").modal({ keyboard: false, backdrop: "static" });
  $("#nickInput").select();
  const firstNick = Meteor.userId() || "";
  $("#nickInput").val(firstNick);
  this.update(firstNick, { force: true });
  $("#nickInput").typeahead({
    source: this.typeaheadSource,
    updater: (item) => {
      this.update(item);
      return item;
    },
  });
});
Template.login.events({
  "click .bb-submit"(event, template) {
    $("#nickPick").submit();
  },
  "input #nickInput"(event, template) {
    nickInput.changed();
  },
  "keydown #nickInput"(event, template) {
    // implicit submit on <enter> if typeahead isn't shown
    if (event.which === 13 && !$("#nickInput").data("typeahead").shown) {
      $("#nickPick").submit();
    }
  },
  "keydown #nickRealname"(event, template) {
    if (event.which === 13) {
      $("#nickEmail").select();
    }
  },
  "keydown #nickEmail"(event, template) {
    if (event.which === 13) {
      $("#nickPick").submit();
    }
  },
  "input #nickEmail": _.debounce(
    (event, template) => template.updateGravatar(),
    500,
  ),
  "submit #nickPick"(event, template) {
    const nick = $("#nickInput")
      .val()
      .replace(/^\s+|\s+$/g, ""); //trim
    if (!nick) {
      return false;
    }
    loginWithCodex(
      nick,
      $("#nickRealname").val(),
      $("#nickEmail").val(),
      $("#passwordInput").val(),
      function (err, res) {
        if (err != null) {
          const le = $("#loginError");
          if (err.reason != null) {
            le.text(err.reason);
          }
          if (err.details?.field != null) {
            template.$("[data-argument]").removeClass("error");
            template
              .$(`[data-argument=\"${err.details.field}\"]`)
              .addClass("error");
          }
        }
      },
    );
    return false;
  },
});
