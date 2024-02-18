import canonical from "/lib/imports/canonical.js";
import {
  CallIns,
  Puzzles,
  Rounds,
  pretty_collection,
} from "/lib/imports/collections.js";
import { getTag, isStuck } from "/lib/imports/tags.js";
import { confirm } from "/client/imports/modal.js";
import color from "./imports/objectColor.js";
import embeddable from "./imports/embeddable.js";
import * as callin_types from "/lib/imports/callin_types.js";
import "/client/imports/ui/components/edit_object_title/edit_object_title.js";
import "/client/imports/ui/components/edit_tag_value/edit_tag_value.js";
import "/client/imports/ui/components/fix_puzzle_drive/fix_puzzle_drive.js";
import "/client/imports/ui/components/onduty/current.js";
import "/client/imports/ui/components/tag_table_rows/tag_table_rows.js";
import "/client/imports/ui/components/time_since/time_since.js";

function capType(puzzle) {
  if (puzzle?.puzzles != null) {
    return "Meta";
  } else {
    return "Puzzle";
  }
}

function possibleViews(puzzle) {
  const x = [];
  if (puzzle?.spreadsheet != null) {
    x.push("spreadsheet");
  }
  if (embeddable(puzzle?.link)) {
    x.push("puzzle");
  }
  x.splice(/Mobi/.test(navigator.userAgent) ? 0 : x.length, 0, "info");
  if (puzzle?.doc != null) {
    x.push("doc");
  }
  return x;
}

function currentViewIs(puzzle, view) {
  // only puzzle and round have view.
  const page = Session.get("currentPage");
  if (page !== "puzzle" && page !== "round") {
    return false;
  }
  const possible = possibleViews(puzzle);
  if (Session.equals("view", view)) {
    if (possible.includes(view)) {
      return true;
    }
  }
  if (possible.includes(Session.get("view"))) {
    return false;
  }
  return view === possible[0];
}

Template.puzzle_info.onCreated(function () {
  this.grandfeeders = new ReactiveVar(false);
  this.unattached = new ReactiveVar(false);
  this.addingTag = new ReactiveVar(false);
  this.autorun(() => {
    const id = Session.get("id");
    if (!id) {
      return;
    }
    this.subscribe("callins-by-puzzle", id);
  });
});

Template.puzzle_info.helpers({
  tag(name) {
    return getTag(this, name) || "";
  },
  getPuzzle(id) {
    return Puzzles.findOne(id);
  },
  caresabout() {
    const cared = getTag(this.puzzle, "Cares About");
    return (cared?.split(",") || []).map((tag) => ({
      name: tag,
      canon: canonical(tag),
    }));
  },
  callins() {
    if (this.puzzle == null) {
      return;
    }
    return CallIns.find(
      {
        target_type: "puzzles",
        target: this.puzzle._id,
      },
      { sort: { created: 1 } }
    );
  },
  callin_status() {
    return callin_types.past_status_message(this.status, this.callin_type);
  },
  metameta() {
    return (
      Puzzles.find({
        _id: { $in: this.puzzle.puzzles },
        puzzles: { $exists: true },
      }).count() > 0
    );
  },
  grandfeeders() {
    return Template.instance().grandfeeders.get();
  },
  unattached() {
    return Template.instance().unattached.get();
  },
  nonfeeders() {
    return Puzzles.find({ feedsInto: { $size: 0 } });
  },
  unsetcaredabout() {
    if (!this.puzzle) {
      return;
    }
    const result = [];
    for (var meta of this.puzzle.feedsInto.map((m) => Puzzles.findOne(m))) {
      if (meta == null) {
        continue;
      }
      for (let tag of meta.tags.cares_about?.value.split(",") || []) {
        if (getTag(this.puzzle, tag)) {
          continue;
        }
        result.push({
          name: tag,
          canon: canonical(tag),
          meta: meta.name,
        });
      }
    }
    return result;
  },
  metatags() {
    if (this.puzzle == null) {
      return;
    }
    const r = [];
    for (var meta of this.puzzle.feedsInto.map((m) => Puzzles.findOne(m))) {
      if (meta == null) {
        continue;
      }
      for (let canon in meta.tags) {
        const tag = meta.tags[canon];
        if (!/^meta /i.test(tag.name)) {
          continue;
        }
        r.push({
          name: tag.name,
          value: tag.value,
          meta: meta.name,
        });
      }
    }
    return r;
  },
  addingTag() {
    const instance = Template.instance();
    return {
      adding() {
        return instance.addingTag.get();
      },
      done() {
        instance.addingTag.set(false);
      },
    };
  },
});

Template.puzzle_info.events({
  "click button.grandfeeders"(event, template) {
    template.grandfeeders.set(
      !event.currentTarget.classList.contains("active")
    );
  },
  "click button.unattached"(event, template) {
    template.unattached.set(!event.currentTarget.classList.contains("active"));
  },
  "change input.feed"(event, template) {
    if (event.currentTarget.checked) {
      Meteor.call("feedMeta", this._id, Template.currentData().puzzle._id);
    } else {
      Meteor.call("unfeedMeta", this._id, Template.currentData().puzzle._id);
    }
  },
  "click .bb-add-tag-button"(event, template) {
    template.addingTag.set(true);
  },
});

const dataHelper = function () {
  const r = {};
  const puzzle = (r.puzzle = Puzzles.findOne(Session.get("id")));
  const round = (r.round = Rounds.findOne({ puzzles: puzzle?._id }));
  r.isMeta = puzzle?.puzzles != null;
  r.stuck = isStuck(puzzle);
  r.capType = capType(puzzle);
  return r;
};

Template.puzzle_info_frame.helpers({
  data: dataHelper,
});

Template.puzzle.helpers({
  data: dataHelper,
  currentViewIs(view) {
    return currentViewIs(this.puzzle, view);
  },
  docLoaded() {
    return Template.instance().docLoaded.get();
  },
});

Template.puzzle.events({
  "click .bb-go-fullscreen"(e, t) {
    $(".bb-puzzleround").get(0)?.requestFullscreen({ navigationUI: "hide" });
  },
});

Template.header_breadcrumb_extra_links.helpers({
  currentViewIs(view) {
    return currentViewIs(this, view);
  },
});

Template.puzzle.onCreated(function () {
  this.docLoaded = new ReactiveVar(false);
  this.autorun(() => {
    if (Session.equals("view", "doc")) {
      this.docLoaded.set(true);
      return;
    }
    Puzzles.findOne(Session.get("id"), { fields: { doc: 1 } });
    this.docLoaded.set(false);
  });
  this.autorun(function () {
    // set page title
    const id = Session.get("id");
    const puzzle = Puzzles.findOne(id);
    const name = puzzle?.name || id;
    $("title").text(`${capType(puzzle)}: ${name}`);
  });
  this.autorun(function () {
    if (!Session.equals("type", "puzzles")) {
      return;
    }
    if (currentViewIs(Puzzles.findOne(Session.get("id")), "info")) {
      Session.set("topRight", null);
    } else {
      Session.set("topRight", "puzzle_info_frame");
    }
  });
  this.autorun(function () {
    const id = Session.get("id");
    if (!id) {
      return;
    }
    const puzzle = Puzzles.findOne(id, { fields: { "tags.color.value": 1 } });
    if (puzzle != null) {
      Session.set("color", color(puzzle));
    } else {
      Session.set("color", "white");
    }
  });
});

Template.puzzle_summon_button.events({
  async "click .bb-summon-btn.stuck"(event, template) {
    if (
      await confirm({
        message: "Are you sure you want to cancel this request for help?",
        ok_button: `Yes, this ${pretty_collection(
          Session.get("type")
        )} is no longer stuck`,
        no_button: "Nevermind, this is still STUCK",
      })
    ) {
      Meteor.call("unsummon", {
        type: Session.get("type"),
        object: Session.get("id"),
      });
    }
  },
  "click .bb-summon-btn.unstuck"(event, template) {
    $("#summon_modal .stuck-at").val("at start");
    $("#summon_modal .stuck-need").val("ideas");
    $("#summon_modal .stuck-other").val("");
    $("#summon_modal .bb-callin-submit").focus();
    $("#summon_modal").modal({ show: true });
  },
});

Template.puzzle_summon_modal.events({
  "click .bb-summon-submit, submit form"(event, template) {
    event.preventDefault(); // don't reload page
    const at = template.$(".stuck-at").val();
    const need = template.$(".stuck-need").val();
    const other = template.$(".stuck-other").val();
    let how = `Stuck ${at}`;
    if (need !== "other") {
      how += `, need ${need}`;
    }
    if (other !== "") {
      how += `: ${other}`;
    }
    Meteor.call("summon", {
      type: Session.get("type"),
      object: Session.get("id"),
      how,
    });
    template.$(".modal").modal("hide");
  },
});

Template.puzzle_callin_button.events({
  "click .bb-callin-btn"(event, template) {
    console.log("click event");
    $("#callin_modal input:text").val("");
    $('#callin_modal input[type="checkbox"]:checked').val([]);
    $("#callin_modal").modal({ show: true });
    $("#callin_modal input:text").focus();
  },
});

Template.puzzle_callin_modal.onCreated(function () {
  this.type = new ReactiveVar(callin_types.ANSWER);
});

const callinTypesHelpers = (template) =>
  template.helpers({
    typeName(type) {
      return callin_types.human_readable(
        type ?? Template.instance().type.get()
      );
    },
    typeNameVerb(type) {
      switch (type ?? Template.instance().type.get()) {
        case callin_types.ANSWER:
          return "Answer to call in";
        case callin_types.PARTIAL_ANSWER:
          return "Partial answer to call in";
        case callin_types.INTERACTION_REQUEST:
          return "Interaction to request";
        case callin_types.MESSAGE_TO_HQ:
          return "Message to send HQ";
        case callin_types.EXPECTED_CALLBACK:
          return "Callback to expect";
        //istanbul ignore next
        default:
          return "";
      }
    },
    tooltip(type) {
      switch (type) {
        case callin_types.ANSWER:
          return "The solution to the puzzle. Fingers crossed!";
        case callin_types.PARTIAL_ANSWER:
          return "One of multiple solutions to the puzzle. (We hope.)";
        case callin_types.INTERACTION_REQUEST:
          return "An intermediate string that may trigger a skit, physical puzzle, or creative challenge.";
        case callin_types.MESSAGE_TO_HQ:
          return "Any other reason for contacting HQ, including spending clue currency and reporting an error.";
        case callin_types.EXPECTED_CALLBACK:
          return "We will be contacted by HQ. No immediate action is required of the oncall.";
        //istanbul ignore next
        default:
          return "";
      }
    },
    callinTypes() {
      return [
        callin_types.ANSWER,
        callin_types.PARTIAL_ANSWER,
        callin_types.INTERACTION_REQUEST,
        callin_types.MESSAGE_TO_HQ,
        callin_types.EXPECTED_CALLBACK,
      ];
    },
  });

callinTypesHelpers(Template.puzzle_callin_modal);
Template.puzzle_callin_modal.helpers({
  typeIs(type) {
    return Template.instance().type.get() === type;
  },
});
callinTypesHelpers(Template.callin_type_dropdown);

Template.puzzle_callin_modal.events({
  "show #callin_modal"(event, template) {
    const puzzle = Puzzles.findOne({ _id: Session.get("id") });
    let initial = callin_types.ANSWER;
    if (puzzle.answers) {
      initial = callin_types.PARTIAL_ANSWER;
    }
    template.type.set(initial);
    template
      .$(`input[name="callin_type"][value="${initial}"]`)
      .prop("checked", true);
  },
  'change input[name="callin_type"]'(event, template) {
    template.type.set(event.currentTarget.value);
  },
  "click .bb-callin-submit, submit form"(event, template) {
    event.preventDefault(); // don't reload page
    const answer = template.$(".bb-callin-answer").val();
    if (!answer) {
      return;
    }
    const args = {
      target: Session.get("id"),
      answer,
      callin_type: template.type.get(),
    };
    if (template.$('input:checked[value="provided"]').val() === "provided") {
      args.provided = true;
    }
    if (template.$('input:checked[value="backsolve"]').val() === "backsolve") {
      args.backsolve = true;
    }
    Meteor.call("newCallIn", args);
    template.$(".modal").modal("hide");
  },
});
