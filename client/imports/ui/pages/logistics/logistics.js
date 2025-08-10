import "./logistics.html";
import "./logistics.less";
import "/client/imports/ui/components/create_object/create_object.js";
import "/client/imports/ui/components/fix_puzzle_drive/fix_puzzle_drive.js";
import {
  CalendarEvents,
  CallIns,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import { confirm } from "/client/imports/modal.js";
import { findByChannel } from "/client/imports/presence_index.js";
import colorFromThingWithTags from "/client/imports/objectColor.js";
import okCancelEvents from "/client/imports/ok_cancel_events.js";
import { all_settings } from "/lib/imports/settings.js";

function nameAndUrlFromDroppedLink(dataTransfer) {
  const url = dataTransfer.getData("url");
  let name;
  if (dataTransfer.types.includes("text/html")) {
    const doc = new DOMParser().parseFromString(
      dataTransfer.getData("text/html"),
      "text/html"
    );
    name = doc.body.innerText.trim();
  }
  if (!name) {
    const parsedUrl = new URL(url);
    name = parsedUrl.pathname.split("/").at(-1);
  }
  return { name, url };
}

const PUZZLE_MIME_TYPE = "application/prs.codex-puzzle";
const CALENDAR_EVENT_MIME_TYPE = "application/prs.codex-calendar-event";

const draggedPuzzle = new ReactiveDict();
const editingPuzzle = new ReactiveVar();

Template.logistics.onCreated(function () {
  Session.set("topRight", "logistics_topright_panel");
  this.creatingRound = new ReactiveVar(false);
  this.createPlaceholderMeta = new ReactiveVar(true);
  // for meta and puzzle the above isn't necessary because the text box is outside the dropdown
  // These store the round the meta/puzzle are being created in.
  this.creatingMeta = new ReactiveVar(null);
  this.creatingPuzzle = new ReactiveVar(null);
  this.autorun(() => {
    this.subscribe("all-presence");
    this.subscribe("pending-callins");
  });
  const self = this;
  this.clickOutsideNewRound = function (event) {
    if (event.target.closest("#bb-logistics-new-round")) {
      return;
    }
    self.creatingRound.set(false);
    return $("body").off("click", self.clickOutsideNewRound);
  };
});

Template.logistics.onRendered(function () {
  $("title").text("Logistics");
  this.autorun(() => {
    if (editingPuzzle.get() != null) {
      this.$("#bb-logistics-edit-dialog").modal("show");
      $(document).on("keydown.dismiss-edit-dialog", (e) => {
        if (e.which === 27) {
          this.$("#bb-logistics-edit-dialog").modal("hide");
        }
      });
    }
  });
});

Template.logistics_round_menu.helpers({
  rounds() {
    return Rounds.find({}, { sort: { sort_key: 1 } });
  },
});

Template.logistics.helpers({
  rounds() {
    return Rounds.find({}, { sort: { sort_key: 1 } });
  },
  standalone(round) {
    const x = [];
    for (let puzzle of round.puzzles) {
      const puz = Puzzles.findOne({ _id: puzzle });
      if (!puz) {
        continue;
      }
      if (puz.feedsInto.length === 0 && puz.puzzles == null) {
        x.push(puz);
      }
    }
    if (x.length) {
      return x;
    }
  },
  metas(round) {
    const x = [];
    for (let puzzle of round.puzzles) {
      const puz = Puzzles.findOne({ _id: puzzle });
      if (!puz) {
        continue;
      }
      if (puz.puzzles != null) {
        x.push(puz);
      }
    }
    return x;
  },
  metaParams(round) {
    return { round, puzzles: [] };
  },
  puzzleParams(round) {
    return { round };
  },
  createPlaceholderMeta() {
    return Template.instance().createPlaceholderMeta.get();
  },
  newRoundParams() {
    return {
      createPlaceholder: Template.instance().createPlaceholderMeta.get(),
    };
  },
  creatingRound() {
    return Template.instance().creatingRound.get();
  },
  doneCreatingRound() {
    const instance = Template.instance();
    return {
      done() {
        const wasStillCreating = instance.creatingRound.get();
        instance.creatingRound.set(false);
        return wasStillCreating;
      },
    };
  },
  creatingMeta() {
    return Template.instance().creatingMeta.get();
  },
  doneCreatingMeta() {
    const instance = Template.instance();
    return {
      done() {
        const wasStillCreating = instance.creatingMeta.get();
        instance.creatingMeta.set(null);
        return wasStillCreating != null;
      },
    };
  },
  creatingStandalone() {
    return Template.instance().creatingPuzzle.get();
  },
  doneCreatingStandalone() {
    const instance = Template.instance();
    return {
      done() {
        const wasStillCreating = instance.creatingPuzzle.get();
        instance.creatingPuzzle.set(null);
        return wasStillCreating != null;
      },
    };
  },
  unfeeding() {
    if (
      draggedPuzzle.get("meta") != null &&
      draggedPuzzle.get("targetMeta") == null &&
      !draggedPuzzle.get("willDelete")
    ) {
      const puzz = Puzzles.findOne({ _id: draggedPuzzle.get("id") });
      if (puzz?.feedsInto.length === 1) {
        return puzz;
      }
    }
  },
  editingPuzzle() {
    const _id = editingPuzzle.get();
    if (_id != null) {
      return Puzzles.findOne({ _id });
    }
  },
  modalColor() {
    const p = Puzzles.findOne({ _id: editingPuzzle.get() });
    if (p != null) {
      return colorFromThingWithTags(p);
    }
  },
});

function allowDropUriList(event, template) {
  if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
    return;
  }
  if (event.originalEvent.dataTransfer.types.includes("text/uri-list")) {
    event.preventDefault();
    event.stopPropagation();
    return (event.originalEvent.dataTransfer.dropEffect = "copy");
  }
}

let lastEnter = null;

function toggleButtonOnDragEnter(event, template) {
  if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
    return;
  }
  if (event.originalEvent.dataTransfer.types.includes("text/uri-list")) {
    event.currentTarget.classList.add("open");
    event.currentTarget.classList.add("dragover");
    lastEnter = event.target;
  }
}

function closeButtonOnDragLeave(event, template) {
  if (event.target === lastEnter) {
    lastEnter = null;
  } else if (event.currentTarget.contains(lastEnter)) {
    return;
  }
  event.currentTarget.classList.remove("open");
  event.currentTarget.classList.remove("dragover");
}

function droppingLink(event, fn) {
  if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
    return;
  }
  if (event.originalEvent.dataTransfer.types.includes("text/uri-list")) {
    event.preventDefault();
    const { name, url } = nameAndUrlFromDroppedLink(
      event.originalEvent.dataTransfer
    );
    fn(name, url);
  }
}

function makePuzzleOnDrop(targetId, puzzleParams) {
  return Template.logistics.events({
    [`drop #${targetId} .round-name`](event, template) {
      event.currentTarget.parentElement.classList.remove("active");
      droppingLink(event, (name, link) => {
        Meteor.serializeCall("newPuzzle", {
          name,
          link,
          round: this._id,
          ...puzzleParams,
        });
      });
    },
  });
}
makePuzzleOnDrop("bb-logistics-new-standalone", {});
makePuzzleOnDrop("bb-logistics-new-meta", { puzzles: [] });

Template.logistics.events({
  "click #bb-logistics-new-round"(event, template) {
    const creatingRoundNow = !template.creatingRound.get();
    template.creatingRound.set(creatingRoundNow);
    if (creatingRoundNow) {
      template.createPlaceholderMeta.set(true);
      $("body").on("click", template.clickOutsideNewRound);
    } else {
      $("body").off("click", template.clickOutsideNewRound);
    }
  },
  "click .dropdown-menu.stay-open"(event, template) {
    event.stopPropagation();
  },
  "click #bb-logistics-new-meta a.round-name"(event, template) {
    template.creatingMeta.set(this._id);
  },
  "click #bb-logistics-new-standalone a.round-name"(event, template) {
    template.creatingPuzzle.set(this._id);
  },
  "change #create-placeholder-meta"(event, template) {
    template.createPlaceholderMeta.set(event.currentTarget.checked);
  },
  "dragstart .bb-logistics-standalone .puzzle"(event, template) {
    const data = { id: this._id, meta: null };
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(
      PUZZLE_MIME_TYPE,
      JSON.stringify(data)
    );
    event.originalEvent.dataTransfer.effectAllowed = "all";
  },
  "dragstart .bb-calendar-event"(event, template) {
    event.originalEvent.dataTransfer.setData(
      CALENDAR_EVENT_MIME_TYPE,
      this.event._id
    );
    event.originalEvent.dataTransfer.effectAllowed = "link";
  },
  "dragend .bb-logistics-standalone .puzzle"(event, template) {
    draggedPuzzle.clear();
  },
  "dragover .bb-logistics"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      if (draggedPuzzle.get("meta") != null) {
        event.originalEvent.dataTransfer.dropEffect = "move";
      } else {
        event.originalEvent.dataTransfer.dropEffect = "none";
      }
    } else {
      event.originalEvent.dataTransfer.dropEffect = "none";
    }
    event.stopPropagation();
    event.preventDefault();
  },
  "dragover #bb-logistics-new-round [data-create-placeholder-meta]":
    allowDropUriList,
  "dragover #bb-logistics-new-meta .round-name": allowDropUriList,
  "dragover #bb-logistics-new-standalone .round-name": allowDropUriList,
  "dragover #bb-logistics-delete"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.originalEvent.dataTransfer.dropEffect = "move";
      event.stopPropagation();
      event.preventDefault();
    }
  },
  "dragenter li:not(.disabled)"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes("text/uri-list")) {
      event.currentTarget.classList.add("active");
    }
  },
  "dragleave li:not(.disabled)"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes("text/uri-list")) {
      event.currentTarget.classList.remove("active");
    }
  },
  "dragenter .bb-logistics"(event, template) {
    template.creatingRound.set(false);
  },
  "dragenter #bb-logistics-new-round": toggleButtonOnDragEnter,
  "dragenter #bb-logistics-new-meta": toggleButtonOnDragEnter,
  "dragenter #bb-logistics-new-standalone": toggleButtonOnDragEnter,
  "dragenter #bb-logistics-delete"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.currentTarget.classList.add("dragover");
      lastEnter = event.target;
      draggedPuzzle.set("willDelete", true);
    }
  },

  "dragleave #bb-logistics-new-round": closeButtonOnDragLeave,
  "dragleave #bb-logistics-new-meta": closeButtonOnDragLeave,
  "dragleave #bb-logistics-new-standalone": closeButtonOnDragLeave,
  "dragleave #bb-logistics-delete"(event, template) {
    if (event.target === lastEnter) {
      lastEnter = null;
    } else if (event.currentTarget.contains(lastEnter)) {
      return;
    }
    event.currentTarget.classList.remove("dragover");
    draggedPuzzle.set("willDelete", false);
  },
  "drop .bb-logistics"(event, template) {
    if (!event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const data = JSON.parse(
      event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE)
    );
    if (data.meta != null) {
      Meteor.serializeCall("unfeedMeta", data.id, data.meta);
    }
  },
  "drop #bb-logistics-new-round [data-create-placeholder-meta]"(
    event,
    template
  ) {
    event.currentTarget.parentElement.classList.remove("active");
    droppingLink(event, function (name, link) {
      Meteor.serializeCall("newRound", {
        name,
        link,
        createPlaceholder:
          event.currentTarget.dataset.createPlaceholderMeta === "true",
      });
    });
  },
  "drop #bb-logistics-new-round, drop #bb-logistics-new-meta, drop #bb-logistics-new-standalone"(
    event,
    template
  ) {
    lastEnter = null;
    event.currentTarget.classList.remove("dragover");
    event.currentTarget.classList.remove("open");
  },
  async "drop #bb-logistics-delete"(event, template) {
    event.currentTarget.classList.remove("dragover");
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.preventDefault();
      event.stopPropagation();
      const data = JSON.parse(
        event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE)
      );
      const puzzle = Puzzles.findOne({ _id: data.id });
      if (puzzle != null) {
        if (
          await confirm({
            ok_button: "Yes, delete it",
            no_button: "No, cancel",
            message: `Are you sure you want to delete the puzzle \"${puzzle.name}\"?`,
          })
        ) {
          Meteor.serializeCall("deletePuzzle", puzzle._id);
        }
      }
    }
  },
  "hidden #bb-logistics-edit-dialog"(event, template) {
    editingPuzzle.set(null);
    $(document).off("keydown.dismiss-edit-dialog");
  },
});

Template.logistics_puzzle.helpers({
  willDelete() {
    if (!draggedPuzzle.equals("id", this._id)) {
      return false;
    }
    if (draggedPuzzle.get("willDelete")) {
      return true;
    }
    const targetMeta = draggedPuzzle.get("targetMeta");
    if (targetMeta != null) {
      return this.feedsInto.length === 0;
    } else {
      return draggedPuzzle.equals("meta", Template.parentData()?.meta?._id);
    }
  },
  draggingIn() {
    const localMeta = Template.parentData()?.meta;
    if (localMeta == null) {
      return false;
    }
    return (
      draggedPuzzle.equals("id", this._id) &&
      draggedPuzzle.equals("targetMeta", localMeta._id) &&
      !this.feedsInto.includes(draggedPuzzle.get("targetMeta"))
    );
  },
});

function editButton(event, puzzleId) {
  if (event.button !== 0) {
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  editingPuzzle.set(puzzleId);
}

Template.logistics_puzzle.events({
  "click .bb-logistics-edit-puzzle"(event, template) {
    editButton(event, this._id);
  },
  "dragover .puzzle"(event, template) {
    if (
      event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)
    ) {
      event.originalEvent.dataTransfer.dropEffect = "link";
      event.preventDefault();
      event.stopPropagation();
    }
  },
  "drop .puzzle"(event, template) {
    if (
      event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)
    ) {
      const id = event.originalEvent.dataTransfer.getData(
        CALENDAR_EVENT_MIME_TYPE
      );
      Meteor.serializeCall("setPuzzleForEvent", id, this._id);
      event.preventDefault();
      event.stopPropagation();
    }
  },
});

Template.logistics_puzzle_events.helpers({
  soonest_ending_current_event() {
    const now = Session.get("currentTime");
    return CalendarEvents.findOne(
      { puzzle: this._id, start: { $lt: now }, end: { $gt: now } },
      { sort: { end: -1 } }
    );
  },
  next_future_event() {
    const now = Session.get("currentTime");
    return CalendarEvents.findOne(
      { puzzle: this._id, start: { $gt: now } },
      { sort: { start: 1 } }
    );
  },
  no_events() {
    return CalendarEvents.find({ puzzle: this._id }).count() === 0;
  },
});

Template.logistics_meta.onCreated(function () {
  this.creatingFeeder = new ReactiveVar(false);
  this.draggingLink = new ReactiveVar(null);
});

Template.logistics_meta.events({
  "click .new-puzzle"(event, template) {
    template.creatingFeeder.set(true);
  },
  "click header .bb-logistics-edit-puzzle"(event, template) {
    editButton(event, this.meta._id);
  },
  "dragstart .feeders .puzzle"(event, template) {
    const data = {
      id: this._id,
      meta: template.data.meta._id,
      targetMeta: template.data.meta._id,
    };
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(
      PUZZLE_MIME_TYPE,
      JSON.stringify(data)
    );
    event.originalEvent.dataTransfer.effectAllowed = "all";
  },
  "dragstart header .meta"(event, template) {
    const data = { id: this.meta._id, meta: null };
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(
      PUZZLE_MIME_TYPE,
      JSON.stringify(data)
    );
    event.originalEvent.dataTransfer.effectAllowed = "all";
  },
  "dragend .feeders .puzzle, dragend .meta"(event, template) {
    draggedPuzzle.clear();
  },
  "dragover header .meta"(event, template) {
    if (
      event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)
    ) {
      event.originalEvent.dataTransfer.dropEffect = "link";
      event.preventDefault();
      event.stopPropagation();
    }
  },
  "dragover .bb-logistics-meta"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      if (draggedPuzzle.equals("meta", template.data.meta._id)) {
        event.originalEvent.dataTransfer.dropEffect = "none";
      } else {
        event.originalEvent.dataTransfer.dropEffect = "link";
      }
    } else if (
      event.originalEvent.dataTransfer.types.includes("text/uri-list")
    ) {
      event.originalEvent.dataTransfer.dropEffect = "copy";
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  },
  "dragenter .bb-logistics-meta"(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      draggedPuzzle.set("targetMeta", this.meta._id);
    } else if (
      !event.originalEvent.dataTransfer.types.includes("text/uri-list")
    ) {
      return;
    }
    template.draggingLink.set(event.target);
  },
  "dragleave .bb-logistics-meta"(event, template) {
    if (template.draggingLink.get() !== event.target) {
      return;
    }
    template.draggingLink.set(null);
    draggedPuzzle.set("targetMeta", null);
  },
  "drop header .meta"(event, template) {
    if (
      event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)
    ) {
      const id = event.originalEvent.dataTransfer.getData(
        CALENDAR_EVENT_MIME_TYPE
      );
      Meteor.serializeCall("setPuzzleForEvent", id, this.meta._id);
      event.preventDefault();
      event.stopPropagation();
    }
  },
  "drop .bb-logistics-meta"(event, template) {
    template.draggingLink.set(null);
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.preventDefault();
      event.stopPropagation();
      const data = JSON.parse(
        event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE)
      );
      if (data.meta === template.data.meta._id) {
        return;
      }
      Meteor.serializeCall("feedMeta", data.id, template.data.meta._id);
    } else {
      droppingLink(event, (name, link) => {
        Meteor.serializeCall("newPuzzle", {
          name,
          link,
          feedsInto: [this.meta._id],
          round: this.round._id,
        });
      });
    }
  },
});

Template.logistics_meta.helpers({
  color() {
    return colorFromThingWithTags(this.meta);
  },
  puzzles() {
    if (this.meta.order_by) {
      return Puzzles.find(
        { feedsInto: this.meta._id },
        { sort: { [this.meta.order_by]: 1 } }
      );
    }
    return this.meta.puzzles.map((_id) => Puzzles.findOne({ _id }));
  },
  feederParams() {
    return {
      round: this.round._id,
      feedsInto: [this.meta._id],
    };
  },
  creatingFeeder() {
    return Template.instance().creatingFeeder.get();
  },
  draggingLink() {
    return Template.instance().draggingLink.get();
  },
  doneCreatingFeeder() {
    const instance = Template.instance();
    return {
      done() {
        const wasStillCreating = instance.creatingFeeder.get();
        instance.creatingFeeder.set(false);
        return wasStillCreating;
      },
    };
  },
  willDelete() {
    return (
      draggedPuzzle.get("willDelete") &&
      draggedPuzzle.equals("id", this.meta._id)
    );
  },
  fromAnotherMeta() {
    if (draggedPuzzle.equals("id", undefined)) {
      return false;
    }
    return !draggedPuzzle.equals("meta", this.meta._id);
  },
  draggedPuzzle() {
    return Puzzles.findOne({ _id: draggedPuzzle.get("id") });
  },
});

Template.logistics_puzzle_presence.helpers({
  presenceForScope(scope) {
    return findByChannel(
      `puzzles/${this._id}`,
      { [scope]: { $gt: 0 } },
      { fields: { [scope]: 1 } }
    ).count();
  },
});

Template.logistics_callins_table.helpers({
  callins() {
    return CallIns.find(
      { status: "pending" },
      {
        sort: [["created", "asc"]],
        transform(c) {
          c.puzzle = c.target ? Puzzles.findOne({ _id: c.target }) : undefined;
          return c;
        },
      }
    );
  },
});

Template.logistics_callin_row.onCreated(function () {
  this.autorun(() => {
    const data = Template.currentData();
    if (!data.puzzle) {
      return;
    }
    this.subscribe("callins-by-puzzle", data.puzzle._id);
  });
});

Template.logistics_callin_row.helpers({
  lastAttempt() {
    if (this.puzzle == null) {
      return null;
    }
    return CallIns.findOne(
      { target_type: "puzzles", target: this.puzzle._id, status: "rejected" },
      {
        sort: { resolved: -1 },
        limit: 1,
        fields: { resolved: 1 },
      }
    )?.resolved;
  },

  hunt_link() {
    return this.puzzle?.link;
  },
  solved() {
    return this.puzzle?.solved;
  },
  alreadyTried() {
    if (this.puzzle == null) {
      return;
    }
    return (
      CallIns.findOne(
        {
          target_type: "puzzles",
          target: this.puzzle._id,
          status: "rejected",
          answer: this.answer,
        },
        { fields: {} }
      ) != null
    );
  },
  callinTypeIs(type) {
    return this.callin_type === type;
  },
});

Template.logistics_callin_row.events({
  "change .bb-submitted-to-hq"(event, template) {
    const checked = !!event.currentTarget.checked;
    Meteor.serializeCall("setField", {
      type: "callins",
      object: this._id,
      fields: {
        submitted_to_hq: checked,
        submitted_by: checked ? Meteor.userId() : null,
      },
    });
  },
});

Template.logistics_topright_panel.onCreated(function () {
  this.settings_expanded = new ReactiveVar(false);
});

Template.logistics_topright_panel.helpers({
  settings_expanded() {
    return Template.instance().settings_expanded.get();
  },
  settings() {
    return Object.values(all_settings);
  },
});

Template.logistics_topright_panel.events({
  "click .bb-logistics-dynamic-settings-header"(event, template) {
    template.settings_expanded.set(!template.settings_expanded.get());
  },
});

Template.logistics_dynamic_setting.onCreated(function () {
  this.currentValue = new ReactiveVar(null);
});

function currentValueHelper(unchanged, success, errorFn) {
  return function () {
    try {
      const value = Template.instance().currentValue.get();
      if (value == null) {
        return;
      }
      const newValue = this.convert(value);
      if (newValue === this.get()) {
        return unchanged;
      }
      return success;
    } catch (error) {
      return errorFn(error);
    }
  };
}

Template.logistics_dynamic_setting.helpers({
  input_type() {
    switch (this.matcher) {
      case Boolean:
        return "checkbox";
      case Match.Integer:
        return "number";
      default:
        return "text";
    }
  },
  settingEditClass: currentValueHelper("info", "success", () => "error"),
  settingEditStatus: currentValueHelper("unchanged", null, (error) =>
    error.message.replaceAll("Match error: ", "")
  ),
});

Template.logistics_dynamic_setting.events({
  'input/focus input[type="text"]'(event, template) {
    template.currentValue.set(event.currentTarget.value);
  },
  'blur input[type="text"]'(event, template) {
    template.currentValue.set(null);
  },
  'change input[type="checkbox"]'(event, template) {
    this.set(event.currentTarget.checked);
  },
  ...okCancelEvents('input[type="text"],input[type="number"]', {
    ok(value, event, template) {
      try {
        this.convert(value);
        this.set(value);
      } catch (error) {
        event.currentTarget.value = this.get();
      }
      event.currentTarget.blur();
    },
    cancel(event, template) {
      event.currentTarget.value = this.get();
      event.currentTarget.blur();
    },
  }),
});
