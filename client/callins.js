import { MUTE_SOUND_EFFECTS, EXPERT_MODE } from "./imports/settings.js";
import { CallIns } from "/lib/imports/collections.js";
import * as callin_types from "/lib/imports/callin_types.js";

Meteor.startup(function () {
  let newCallInSound;
  if (typeof Audio === "function") {
    // for phantomjs
    newCallInSound = new Audio(
      Meteor._relativeToSiteRootUrl("/sound/new_callin.wav")
    );
  }

  if (newCallInSound?.play == null) {
    return;
  }
  // note that this observe 'leaks'; that's ok, the set of callins is small
  Tracker.autorun(function () {
    const sub = Meteor.subscribe("callins");
    if (!sub.ready()) {
      return;
    } // reactive, will re-execute when ready
    let initial = true;
    const query = { status: "pending" };
    if (!Session.equals("currentPage", "callins")) {
      query.callin_type = "answer";
    }
    CallIns.find(query).observe({
      async added(doc) {
        if (initial) {
          return;
        }
        console.log("ding dong");
        if (MUTE_SOUND_EFFECTS.get()) {
          return;
        }
        try {
          await newCallInSound.play();
        } catch (err) {
          console.error(err.message, err);
        }
      },
    });
    initial = false;
  });
});

Template.callin_copy_and_go.events({
  async "click .copy-and-go"(event, template) {
    event.preventDefault();
    const url = event.currentTarget.href;
    await navigator.clipboard.writeText(
      $(event.currentTarget.dataset.clipboardTarget).text()
    );
    Meteor.call("setField", {
      type: "callins",
      object: this.callin._id,
      fields: {
        submitted_to_hq: true,
        submitted_by: Meteor.userId(),
      },
    });
    window.open(url, "_blank");
  },
});

Template.callin_type_dropdown.events({
  "click a[data-callin-type]"(event, template) {
    Meteor.call("setField", {
      type: "callins",
      object: this._id,
      fields: {
        callin_type: event.currentTarget.dataset.callinType,
      },
    });
  },
});

Template.callin_resolution_buttons.helpers({
  allowsResponse() {
    return this.callin.callin_type !== callin_types.ANSWER;
  },
  allowsIncorrect() {
    return this.callin.callin_type !== callin_types.EXPECTED_CALLBACK;
  },
  accept_message() {
    return callin_types.accept_message(this.callin.callin_type);
  },
  reject_message() {
    return callin_types.reject_message(this.callin.callin_type);
  },
  cancel_message() {
    return callin_types.cancel_message(this.callin.callin_type);
  },
});

Template.callin_resolution_buttons.events({
  "click .bb-callin-correct"(event, template) {
    const response = template.find("input.response")?.value;
    if (response != null && response !== "") {
      Meteor.call("correctCallIn", this.callin._id, response);
    } else {
      Meteor.call("correctCallIn", this.callin._id);
    }
  },

  "click .bb-callin-incorrect"(event, template) {
    const response = template.find("input.response")?.value;
    if (response != null && response !== "") {
      Meteor.call("incorrectCallIn", this.callin._id, response);
    } else {
      Meteor.call("incorrectCallIn", this.callin._id);
    }
  },

  "click .bb-callin-cancel"(event, template) {
    Meteor.call("cancelCallIn", { id: this.callin._id });
  },
});
