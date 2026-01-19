import md5 from "md5";
import abbrev from "/lib/imports/abbrev.js";
import {
  human_readable,
  abbrev as ctabbrev,
} from "/lib/imports/callin_types.js";
import canonical from "/lib/imports/canonical.js";
import {
  BBCollection,
  Messages,
  Names,
  Puzzles,
  Roles,
  collection,
  pretty_collection,
} from "/lib/imports/collections.js";
import { mechanics } from "/lib/imports/mechanics.js";
import { fileType } from "/lib/imports/mime_type.js";
import { isStuck } from "/lib/imports/tags.js";
import embeddable from "/client/imports/embeddable.js";
import keyword_or_positional from "/client/imports/keyword_or_positional.js";
import { gravatarUrl, nickAndName, nickHash } from "/lib/imports/nickEmail.js";
import * as notification from "/client/imports/notification.js";
import { chatUrlFor, navigate, urlFor } from "/client/imports/router.js";
import {
  GENERAL_ROOM_NAME,
  NAME_PLACEHOLDER,
  TEAM_NAME,
} from "/lib/imports/server_settings.js";
import {
  DARK_MODE,
  MUTE_SOUND_EFFECTS,
  FIRST_LOGIN,
} from "/client/imports/settings.js";
import textify from "/client/imports/textify.js";
import { plain_text } from "/client/imports/chunk_text.js";
import "/client/imports/ui/components/splitter/splitter.js";
import "/client/imports/ui/pages/graph/graph_page.js";
import "/client/imports/ui/pages/map/map_page.js";
import "/client/imports/ui/pages/projector/projector.js";
import "/client/imports/ui/pages/statistics/statistics_page.js";
import "/client/imports/ui/pages/login/login.js";

Template.page.events({
  'click a[href^="/"]'(event, template) {
    if (event.button !== 0) {
      return;
    } // check right-click
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return;
    } // check alt/ctrl/shift/command clicks
    const target = event.currentTarget;
    // href on the element directly is absolute. We want the relative path if it exists for routing.
    event.preventDefault();
    // istanbul ignore if
    if (target.classList.contains("bb-pop-out")) {
      // here we want the absolute path since it's for a new window.
      window.open(
        target.href,
        "Pop out",
        "height=480,width=480,menubar=no,toolbar=no,personalbar=no," +
          "status=yes,resizeable=yes,scrollbars=yes"
      );
    } else {
      navigate(target.getAttribute("href"));
    }
  },
});

Meteor.startup(function () {
  // see if we've got native emoji support, and add the 'has-emojis' class
  // if so; inspired by
  // https://stackoverflow.com/questions/27688046/css-reference-to-phones-emoji-font
  const checkEmoji = function (char, x, y, fillStyle = "#000") {
    const node = document.createElement("canvas");
    const ctx = node.getContext("2d");
    ctx.fillStyle = fillStyle;
    ctx.textBaseline = "top";
    ctx.font = "32px Arial";
    ctx.fillText(char, 0, 0);
    return ctx.getImageData(x, y, 1, 1);
  };
  const reddot = checkEmoji("\uD83D\uDD34", 16, 16);
  const dancing = checkEmoji("\uD83D\uDD7A", 12, 16); // unicode 9.0
  // istanbul ignore else
  if (
    reddot.data[0] > reddot.data[1] &&
    dancing.data[0] + dancing.data[1] + dancing.data[2] > 0
  ) {
    console.log("has unicode 9 color emojis");
    document.body.classList.add("has-emojis");
  }
});

Meteor.startup(function () {
  Tracker.autorun(function (computation) {
    if (Meteor.userId() == null) {
      // Not logged in
      return;
    }
    if (!FIRST_LOGIN.get()) {
      // Have logged in before.
      computation.stop();
      return;
    }

    if (notification.shouldAsk()) {
      notification.ask();
    }

    FIRST_LOGIN.set(false);
  });
});

// Update 'currentTime' every minute or so to allow pretty_ts to magically
// update
Meteor.startup(function () {
  Session.set("currentTime", Date.now());
  Meteor.setInterval(function () {
    Session.set("currentTime", Date.now());
  }, 60 * 1000);
});

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
Template.registerHelper("minus", (a, b) => a - b);
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
["currentPage"].map(function (v) {
  Template.registerHelper(v, () => Session.get(v));
  Template.registerHelper(`${v}Equals`, (arg) => Session.equals(v, arg));
});
Template.registerHelper("abbrev", abbrev);
Template.registerHelper("callinType", human_readable);
Template.registerHelper("callinTypeAbbrev", ctabbrev);
Template.registerHelper("canonical", canonical);

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
Template.registerHelper("drive_link", function (args) {
  args = keyword_or_positional("id", args);
  return `https://docs.google.com/folder/d/${args.id}/edit`;
});
Template.registerHelper("spread_link", function (args) {
  args = keyword_or_positional("id", args);
  return `https://docs.google.com/spreadsheets/d/${args.id}/edit`;
});
Template.registerHelper("doc_link", function (args) {
  args = keyword_or_positional("id", args);
  return `https://docs.google.com/document/d/${args.id}/edit`;
});

// nicks
Template.registerHelper("nickOrName", function (args) {
  const { nick } = keyword_or_positional("nick", args);
  const n = Meteor.users.findOne(canonical(nick));
  return n?.real_name || n?.nickname || nick;
});
Template.registerHelper("nickAndName", function (args) {
  const { nick } = keyword_or_positional("nick", args);
  const n = Meteor.users.findOne(canonical(nick ?? { nickname: nick }));
  return nickAndName(n);
});
Template.registerHelper(
  "nickExists",
  (nick) => Meteor.users.findOne({ _id: nick }) != null
);

Template.registerHelper("stuck", isStuck);

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
      if (
        !notification.granted() ||
        !notification.get(msg.stream) ||
        suppress
      ) {
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
        data = { url: urlFor(msg.type, msg.id) };
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
  // Notifications on favorite mechanics
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
            data: { url: urlFor("puzzles", id) },
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
              return [`${pretty_type} \"${target.name}\"`, urlFor(type, id)];
            } else {
              return [message.room_name, chatUrlFor(message.room_name)];
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
        } else {
          body = plain_text(body);
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
        if (
          !notification.granted() ||
          !notification.get("announcements") ||
          suppress
        ) {
          return;
        }
        const data = { url: Meteor._relativeToSiteRootUrl("/") };
        // If sound effects are off, notifications should be silent. If they're not, turn off sound for
        // notifications that already have sound effects.
        const silent = MUTE_SOUND_EFFECTS.get();
        let { body } = msg;
        if (msg.bodyIsHtml) {
          body = textify(body);
        } else {
          body = plain_text(body);
        }
        notification.notify(`Announcement by ${msg.nick}`, {
          body,
          tag: msg._id,
          icon: gravatarForNotification(msg),
          data,
          silent,
        });
      },
    });
  });
});

window.collections = BBCollection;
