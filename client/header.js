import {
  LastRead,
  Messages,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import { hashFromNickObject } from "/lib/imports/nickEmail.js";
import { GENERAL_ROOM_NAME } from "/lib/imports/server_settings.js";
import "./imports/timestamp.js";
import "./imports/ui/components/connection_button/connection_button.js";

const privateMessageTransform = (msg) => ({
  _id: msg._id,
  message: msg,

  read() {
    return (
      msg.timestamp <= LastRead.findOne("private")?.timestamp ||
      msg.timestamp <= LastRead.findOne(msg.room_name)?.timestamp
    );
  },

  showRoom: true,
});

Template.header_loginmute.onCreated(function () {
  this.visibleTab = new ReactiveVar("private");
});

function unreadHelper(filter) {
  const count = Messages.find({
    timestamp: { $gt: LastRead.findOne("private")?.timestamp ?? 0 },
    ...filter,
  })
    .fetch()
    .filter(
      (msg) => msg.timestamp > (LastRead.findOne(msg.room_name)?.timestamp ?? 0)
    ).length;
  if (count !== 0) {
    return count;
  }
}

//############# log in/protect/mute panel ####################
Template.header_loginmute.helpers({
  sessionNick() {
    // TODO(torgen): replace with currentUser
    const user = Meteor.user();
    return {
      name: user.nickname,
      canon: user._id,
      realname: user.real_name || user.nickname,
      gravatar_md5: hashFromNickObject(user),
    };
  },
  unreadPrivateMessages() {
    return unreadHelper({ to: Meteor.userId() });
  },
  unreadMentions() {
    return unreadHelper({ mention: Meteor.userId() });
  },
  clamp(value, limit) {
    if (value > limit) {
      return `${limit}+`;
    }
    return value;
  },
  privateMessages() {
    return Messages.find(
      { to: Meteor.userId() },
      {
        sort: { timestamp: -1 },
        transform: privateMessageTransform,
      }
    );
  },
  mentions() {
    return Messages.find(
      { mention: Meteor.userId() },
      {
        sort: { timestamp: -1 },
        transform: privateMessageTransform,
      }
    );
  },
  isVisible(tabname) {
    return Template.instance().visibleTab.get() === tabname;
  },
});

function clickOutsideAvatarDropdownHandler(event) {
  if (event.target.closest("#bb-avatar-dropdown")) {
    return;
  }
  $("#bb-avatar-dropdown").removeClass("open");
  return $("body").off("click", clickOutsideAvatarDropdownHandler);
}

Template.header_loginmute.events({
  "click .bb-logout"(event, template) {
    event.preventDefault();
    Meteor.logout();
  },
  "click li[data-tab]:not(.active)"(event, template) {
    template.visibleTab.set(event.currentTarget.dataset.tab);
  },
  "click #bb-mark-private-read"(event, template) {
    event.preventDefault();
    const latest = Messages.findOne(
      { $or: [{ to: Meteor.userId() }, { mention: Meteor.userId() }] },
      { sort: { timestamp: -1 } }
    ).timestamp;
    Meteor.serializeCall("updateLastRead", {
      room_name: "private",
      timestamp: latest,
    });
  },
  "click #bb-avatar-dropdown > .dropdown-toggle"(event, template) {
    const dropdown = template.$("#bb-avatar-dropdown");
    const open = dropdown.hasClass("open");
    dropdown.toggleClass("open");
    if (open) {
      $("body").off("click", clickOutsideAvatarDropdownHandler);
    } else {
      $("body").on("click", clickOutsideAvatarDropdownHandler);
    }
  },
});

//############# breadcrumbs #######################

function crumbs_equal(x, y) {
  if (x.length !== y.length) {
    return false;
  }
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = y[i];
    if (xi.type !== yi.type) {
      return false;
    }
    if (xi.page !== yi.page) {
      return false;
    }
    if (xi.id === yi.id) {
      continue;
    }
    if ("object" !== typeof xi.id) {
      return false;
    }
    if ("object" !== typeof yi.id) {
      return false;
    }
    if (Object.keys(xi.id).length !== Object.keys(yi.id).length) {
      return false;
    }
    for (let k in xi.id) {
      const v = xi.id[k];
      if (yi.id[k] == null) {
        return false;
      }
      if (yi.id[k] !== v) {
        return false;
      }
    }
  }
  return true;
}

const breadcrumbs_var = new ReactiveVar(
  [{ page: "blackboard", type: "general", id: "0" }],
  crumbs_equal
);

function in_crumbs(crumbs, type, id) {
  if (crumbs == null) {
    return false;
  }
  for (let crumb of crumbs) {
    if (crumb.type !== type) {
      continue;
    }
    if (crumb.page === "metas") {
      if (crumb.id[id] != null) {
        return true;
      }
    } else {
      if (crumb.id === id) {
        return true;
      }
    }
  }
  return false;
}

// One autorun to determine if the current page should be the leaf.
// Basically, if the current page isn't in the current breadcrumb trail,
// it should be the leaf.
Tracker.autorun(function () {
  const breadcrumbs = breadcrumbs_var.get();
  const type = Session.get("type");
  const id = Session.get("id");
  if (!in_crumbs(breadcrumbs, type, id)) {
    Session.set({
      breadcrumbs_leaf_type: type,
      breadcrumbs_leaf_id: id,
    });
  }
});

// Because our graph is unweighted, BFS suffices--we don't need something fancy
// like Dijkstra.
function min_meta_paths(root) {
  let depth = 0;
  let current = [root];
  let next = {};
  const depths = {};
  const trail = [];
  depths[root] = -1;
  while (true) {
    for (let id of current) {
      const puzzle = Puzzles.findOne(id);
      if (puzzle == null) {
        continue;
      }
      for (let meta of puzzle.feedsInto) {
        if (depths[meta] == null) {
          depths[meta] = depth;
          next[meta] = depth;
        }
      }
    }
    current = Object.keys(next);
    if (!current.length) {
      return trail;
    }
    trail.push(next);
    depth++;
    next = {};
  }
}

function generate_crumbs(leaf_type, leaf_id) {
  const crumbs = [{ page: "blackboard", type: "general", id: "0" }];
  leaf_type = Session.get("breadcrumbs_leaf_type");
  leaf_id = Session.get("breadcrumbs_leaf_id");
  if (leaf_type == null || leaf_id == null) {
    return crumbs;
  }
  if (leaf_type === "puzzles") {
    const metas = min_meta_paths(leaf_id);
    // Deepest are last here, so...
    metas.reverse();
    // One breadcrumb for each level of meta.
    // Consider grouping together beyond some number of levels
    for (let meta of metas) {
      crumbs.push({ page: "metas", type: "puzzles", id: meta });
    }
    crumbs.push({ page: "puzzle", type: "puzzles", id: leaf_id });
  } else if (leaf_type === "rounds") {
    crumbs.push({ page: "round", type: "rounds", id: leaf_id });
  } else {
    if (leaf_type !== "general") {
      crumbs.push({ page: leaf_type, type: leaf_type, id: leaf_id });
    }
  }
  return crumbs;
}

// A second autorun to determine what should be in the crumbs.
// Basically, if the current type/id is the leaf, always regenerate the crumbs
// from the breadcrumb leaf.
// Otherwise generate them only if the current type/id appears in the new trail.
// This stops the current crumb from vanishing if you're viewing a meta above a
// puzzle when the puzzle is removed from the meta.
Tracker.autorun(function () {
  const leaf_type = Session.get("breadcrumbs_leaf_type");
  const leaf_id = Session.get("breadcrumbs_leaf_id");
  const crumbs = generate_crumbs(leaf_type, leaf_id);
  const type = Session.get("type");
  const id = Session.get("id");
  if (type !== leaf_type || id !== leaf_id) {
    if (!in_crumbs(crumbs, type, id)) {
      return;
    }
  }
  breadcrumbs_var.set(crumbs);
});

Template.header_breadcrumb_chat.helpers({
  inThisRoom() {
    if (!Session.equals("currentPage", "chat")) {
      return false;
    }
    if (!Session.equals("type", this.type)) {
      return false;
    }
    return Session.equals("id", this.id);
  },
});

function active() {
  return Session.equals("type", this.type) && Session.equals("id", this.id);
}

Template.header_breadcrumb_blackboard.helpers({ active });

Template.header_breadcrumb_extra_links.helpers({
  active() {
    return active.call(Template.parentData(1));
  },
});

Template.header_breadcrumb_round.helpers({
  round() {
    if (this.id) {
      return Rounds.findOne(this.id);
    }
  },
  active,
});

Template.header_breadcrumb_metas.helpers({
  active_meta() {
    if (!Session.equals("type", this.type)) {
      return;
    }
    const id = Session.get("id");
    if (this.id[id] != null) {
      return id;
    }
  },
  inactive_metas() {
    let keys = Object.keys(this.id);
    if (Session.equals("type", this.type)) {
      const id = Session.get("id");
      keys = keys.filter((x) => x !== id);
    }
    if (keys.length === 1) {
      return {
        one: keys[0],
        all: keys,
      };
    } else if (keys.length === 0) {
      return {};
    } else {
      return { all: keys };
    }
  },
});

Template.header_breadcrumb_one_meta.helpers({
  puzzle() {
    if (this.id) {
      return Puzzles.findOne(this.id);
    }
  },
  active,
});

Template.header_breadcrumb_puzzle.helpers({
  puzzle() {
    if (this.id) {
      return Puzzles.findOne(this.id);
    }
  },
  active,
});

Template.header_breadcrumbs.onCreated(function () {
  this.autorun(async function () {
    if (!Meteor.userId()) {
      return;
    }
    if (Meteor.callInFlight()) {
      return;
    }
    await Meteor.serializeCall("getRinghuntersFolder");
    Session.set("RINGHUNTERS_FOLDER", f || undefined);
  });
});

Template.header_breadcrumbs.helpers({
  breadcrumbs() {
    return breadcrumbs_var.get();
  },
  crumb_template() {
    return `header_breadcrumb_${this.page}`;
  },
});

Template.header_breadcrumbs.onRendered(function () {
  // tool tips
  $(this.findAll("a.bb-drive-link[title]")).tooltip({ placement: "bottom" });
});

const RECENT_GENERAL_LIMIT = 2;

//############# operation/chat log in header ####################
Template.header_lastchats.helpers({
  lastchats() {
    const options = [{ room_name: "oplog/0" }, { to: Meteor.userId() }];
    if (!Session.equals("room_name", "general/0")) {
      options.push({ room_name: "general/0" });
    }
    return Messages.find(
      {
        $or: options,
        system: { $ne: true },
        bodyIsHtml: { $ne: true },
        header_ignore: { $ne: true },
      },
      { sort: [["timestamp", "desc"]], limit: RECENT_GENERAL_LIMIT }
    );
  },
  roomname() {
    if (Session.equals("room_name", "general/0")) {
      return "Updates";
    } else {
      return GENERAL_ROOM_NAME;
    }
  },
  roomicon() {
    let query;
    return (query = Session.equals("room_name", "general/0")
      ? "newspaper"
      : "comments");
  },
  puzzle_id() {
    return this.room_name.match(/puzzles\/(.*)/)[1];
  },
  icon_label() {
    if (this.type === "roles") {
      return ["pager", this.id != null ? "success" : "important"];
    } else if (/Added/.test(this.body)) {
      if (this.type === "puzzles") {
        return ["puzzle-piece", "success"];
      } else if (this.type === "rounds") {
        return ["globe", "success"];
      } else {
        return ["plus"];
      }
    } else if (/Deleted answer/.test(this.body)) {
      return ["sad-tear", "important"];
    } else if (/Deleted/.test(this.body)) {
      return ["trash-alt", "info"];
    } else if (/Renamed/.test(this.body)) {
      return ["id-badge", "info"];
    } else if (/New.*submitted for/.test(this.body)) {
      return ["phone", "success"];
    } else if (/Canceled call-in/.test(this.body)) {
      return ["phone-slash", "important"];
    } else if (/Help requested/.test(this.body)) {
      return ["ambulance", "warning"];
    } else if (/Help request cancelled/.test(this.body)) {
      return ["lightbulb", "success"];
    } else if (/Found one of several answers/.test(this.body)) {
      return ["award", "success"];
    } else if (/Found (an|the final) answer/.test(this.body)) {
      return ["trophy", "success"];
    } else if (/reports incorrect answer/.test(this.body)) {
      return ["heart-broken", "important"];
    } else {
      return ["exclamation-circle"];
    }
  },
});

// subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastchats.onCreated(function () {
  this.autorun(() => {
    this.subscribe("recent-messages", "oplog/0", 2);
    this.subscribe("recent-header-messages");
  });
});
