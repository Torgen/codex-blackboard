import md5 from "md5";
import { gravatarUrl, nickHash } from "./imports/nickEmail.js";
import abbrev from "../lib/imports/abbrev.js";
import canonical from "/lib/imports/canonical.js";
import {
  BBCollection,
  Messages,
  Names,
  Puzzles,
  collection,
  pretty_collection,
} from "/lib/imports/collections.js";
import {
  human_readable,
  abbrev as ctabbrev,
} from "../lib/imports/callin_types.js";
import { mechanics } from "../lib/imports/mechanics.js";
import { fileType } from "../lib/imports/mime_type.js";
import textify from "./imports/textify.js";
import embeddable from "./imports/embeddable.js";
import {
  GENERAL_ROOM_NAME,
  NAME_PLACEHOLDER,
  TEAM_NAME,
} from "/client/imports/server_settings.js";
import { DARK_MODE, MUTE_SOUND_EFFECTS } from "./imports/settings.js";
import * as notification from "/client/imports/notification.js";
import Router from "/client/imports/router.js";
import "/client/imports/ui/components/splitter/splitter.js";
import "/client/imports/ui/pages/graph/graph_page.js";
import "/client/imports/ui/pages/map/map_page.js";
import "/client/imports/ui/pages/projector/projector.js";
import "/client/imports/ui/pages/statistics/statistics_page.js";

// "Top level" templates:
//   "blackboard" -- main blackboard page
//   "puzzle"     -- puzzle information page
//   "round"      -- round information (much like the puzzle page)
//   "chat"       -- chat room
//   "oplogs"     -- operation logs
//   "callins"    -- answer queue
//   "facts"      -- server performance information
Template.registerHelper("equal", (a, b) => a === b);
Template.registerHelper("less", (a, b) => a < b);
Template.registerHelper("any", function (...args) {
  const adjustedLength = Math.max(args.length, 1),
    a = args.slice(0, adjustedLength - 1),
    options = args[adjustedLength - 1];
  return a.some((x) => x);
});
Template.registerHelper("includes", (haystack, needle) =>
  haystack?.includes(needle)
);
Template.registerHelper("all", function (...args) {
  const adjustedLength = Math.max(args.length, 1),
    a = args.slice(0, adjustedLength - 1),
    options = args[adjustedLength - 1];
  return a.every((x) => x);
});
Template.registerHelper("not", (a) => !a);
Template.registerHelper("split", (value, delimiter) => value.split(delimiter));
Template.registerHelper("concat", function (...args) {
  const adjustedLength = Math.max(args.length, 1),
    a = args.slice(0, adjustedLength - 1),
    options = args[adjustedLength - 1];
  return a.join(options.delimiter ?? "");
});

// session variables we want to make available from all templates
(() =>
  ["currentPage"].map((v) =>
    Template.registerHelper(v, () => Session.get(v))
  ))();
Template.registerHelper("abbrev", abbrev);
Template.registerHelper("callinType", human_readable);
Template.registerHelper("callinTypeAbbrev", ctabbrev);
Template.registerHelper("canonical", canonical);

// register a more precise dependency on the value of currentPage
Template.registerHelper("currentPageEquals", (arg) =>
  Session.equals("currentPage", arg)
);

// register a more precise dependency on the value of type
Template.registerHelper("typeEquals", (arg) => Session.equals("type", arg));
Template.registerHelper(
  "canEdit",
  () =>
    Meteor.userId() &&
    Session.get("canEdit") &&
    Session.equals("currentPage", "blackboard")
);

Template.registerHelper("md5", md5);
Template.registerHelper("fileType", fileType);

Template.registerHelper("teamName", () => TEAM_NAME);
Template.registerHelper("generalRoomName", () => GENERAL_ROOM_NAME);

Template.registerHelper("namePlaceholder", () => NAME_PLACEHOLDER);

Template.registerHelper("mynick", () => Meteor.userId());

Template.registerHelper("embeddable", embeddable);

Template.registerHelper("plural", (x) => x !== 1);

Template.registerHelper("nullToZero", (x) => x ?? 0);

Template.registerHelper(
  "canGoFullScreen",
  () => $("body").get(0)?.requestFullscreen != null
);

Tracker.autorun(function () {
  if (DARK_MODE.get()) {
    return $("body").addClass("darkMode");
  } else {
    return $("body").removeClass("darkMode");
  }
});

Template.page.helpers({
  splitter() {
    return Session.get("splitter");
  },
  topRight() {
    return Session.get("topRight");
  },
  type() {
    return Session.get("type");
  },
  id() {
    return Session.get("id");
  },
  color() {
    return Session.get("color");
  },
});

const allPuzzlesHandle = Meteor.subscribe("all-roundsandpuzzles");

function debouncedUpdate() {
  const now = new ReactiveVar(Date.now());
  const update = (function () {
    let next = now.get();
    const push = _.debounce(() => now.set(next), 1000);
    return function (newNext) {
      if (newNext > next) {
        next = newNext;
        return push();
      }
    };
  })();
  return { now, update };
}

function gravatarForNotification(msg) {
  return gravatarUrl({
    gravatar_md5: nickHash(msg.nick),
    size: 192,
  });
}

Meteor.startup(function () {
  // Notifications based on oplogs
  const { now, update } = debouncedUpdate();
  let suppress = true;
  Tracker.autorun(function () {
    if (notification.count() === 0) {
      suppress = true;
      return;
    } else if (suppress) {
      now.set(Date.now());
    }
    Meteor.subscribe("oplogs-since", now.get(), {
      onReady() {
        return (suppress = false);
      },
    });
  });
  Messages.find({
    room_name: "oplog/0",
    timestamp: { $gt: now.get() },
  }).observe({
    added(msg) {
      update(msg.timestamp);
      if (!notification.granted() || !notification.get(msg.stream) || suppress) {
        return;
      }
      let { body } = msg;
      if (msg.type && msg.id) {
        body = `${body} ${pretty_collection(msg.type)} \
${collection(msg.type).findOne(msg.id)?.name}`;
      }
      let data = undefined;
      if (msg.stream === "callins") {
        data = { url: "/logistics" };
      } else {
        data = { url: Router.urlFor(msg.type, msg.id) };
      }
      // If sound effects are off, notifications should be silent. If they're not, turn off sound for
      // notifications that already have sound effects.
      const silent =
        MUTE_SOUND_EFFECTS.get() || ["callins", "answers"].includes(msg.stream);
      notification.notify(msg.nick, {
        body,
        tag: msg._id,
        icon: gravatarForNotification(msg),
        data,
        silent,
      });
    },
  });
});

Meteor.startup(() =>
  // Notifications on favrite mechanics
  Tracker.autorun(function () {
    if (!allPuzzlesHandle?.ready()) {
      return;
    }
    if (!notification.granted()) {
      return;
    }
    if (!notification.get("favorite-mechanics")) {
      return;
    }
    const myFaves = Meteor.user()?.favorite_mechanics;
    if (!myFaves) {
      return;
    }
    let faveSuppress = true;
    myFaves.forEach((mech) =>
      Puzzles.find({ mechanics: mech }).observeChanges({
        added(id, puzzle) {
          if (faveSuppress) {
            return;
          }
          return notification.notify(puzzle.name, {
            body: `Mechanic \"${mechanics[mech].name}\" added to puzzle \"${puzzle.name}\"`,
            tag: `${id}/${mech}`,
            data: { url: Router.urlFor("puzzles", id) },
            silent: MUTE_SOUND_EFFECTS.get(),
          });
        },
      })
    );
    faveSuppress = false;
  })
);

Meteor.startup(() =>
  // Notifications on private messages and mentions
  Tracker.autorun(function () {
    if (!allPuzzlesHandle?.ready()) {
      return;
    }
    if (!notification.granted()) {
      return;
    }
    if (!notification.get("private-messages")) {
      return;
    }
    const me = Meteor.user()?._id;
    if (me == null) {
      return;
    }
    const arnow = Date.now(); // Intentionally not reactive
    Messages.find({
      $or: [{ to: me }, { mention: me }],
      timestamp: { $gt: arnow },
    }).observeChanges({
      added(msgid, message) {
        const [room_name, url] = (() => {
          if (message.room_name === "general/0") {
            return [GENERAL_ROOM_NAME, Meteor._relativeToSiteRootUrl("/")];
          } else {
            const [type, id] = message.room_name.split("/");
            const target = Names.findOne(id);
            if (target.type === type) {
              const pretty_type = pretty_collection(type).replace(
                /^[a-z]/,
                (x) => x.toUpperCase()
              );
              return [
                `${pretty_type} \"${target.name}\"`,
                Router.urlFor(type, id),
              ];
            } else {
              return [message.room_name, Router.chatUrlFor(message.room_name)];
            }
          }
        })();
        const gravatar = gravatarUrl({
          gravatar_md5: nickHash(message.nick),
          size: 192,
        });
        let { body } = message;
        if (message.bodyIsHtml) {
          body = textify(body);
        }
        const description =
          message.to != null
            ? `Private message from ${message.nick} in ${room_name}`
            : `Mentioned by ${message.nick} in ${room_name}`;
        notification.notify(description, {
          body,
          tag: msgid,
          data: { url },
          icon: gravatar,
          silent: MUTE_SOUND_EFFECTS.get(),
        });
      },
    });
  })
);

Meteor.startup(function () {
  // Notifications on announcements
  const { now, update } = debouncedUpdate();
  let suppress = true;
  Tracker.autorun(function () {
    if (!notification.granted()) {
      return;
    }
    if (!notification.get("announcements")) {
      suppress = true;
      return;
    } else if (suppress) {
      now.set(Date.now());
    }
    Meteor.subscribe("announcements-since", now.get(), {
      onReady() {
        suppress = false;
      },
    });
    Messages.find({ announced_at: { $gt: now.get() } }).observe({
      added(msg) {
        update(msg.announced_at);
        if (!notification.granted() || !notification.get("announcements") || suppress) {
          return;
        }
        const data = { url: Meteor._relativeToSiteRootUrl("/") };
        // If sound effects are off, notifications should be silent. If they're not, turn off sound for
        // notifications that already have sound effects.
        const silent = MUTE_SOUND_EFFECTS.get();
        notification.notify(`Announcement by ${msg.nick}`, {
          body: msg.body,
          tag: msg._id,
          icon: gravatarForNotification(msg),
          data,
          silent,
        });
      },
    });
  });
});

Backbone.history.start({ pushState: true });

window.collections = BBCollection;
