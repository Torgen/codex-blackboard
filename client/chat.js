import { urlFor, goToChat } from "/client/imports/router.js";
// Cannot destructure for testing purposes.
import jitsiModule, { jitsiUrl, jitsiRoom } from "./imports/jitsi.js";
import {
  gravatarUrl,
  hashFromNickObject,
  nickAndName,
} from "/lib/imports/nickEmail.js";
import { computeMessageFollowup } from "./imports/followup.js";
import botuser from "./imports/botuser.js";
import canonical from "/lib/imports/canonical.js";
import {
  LastRead,
  Messages,
  Names,
  Polls,
  Presence,
  Puzzles,
  collection,
} from "/lib/imports/collections.js";
import {
  CHAT_LIMIT_INCREMENT,
  CLIENT_UUID,
  GENERAL_ROOM_NAME,
  INITIAL_CHAT_LIMIT,
} from "/lib/imports/server_settings.js";
import { TypingIndicatorCharacters } from "/lib/imports/settings.js";
import {
  CAP_JITSI_HEIGHT,
  HIDE_USELESS_BOT_MESSAGES,
  MUTE_SOUND_EFFECTS,
} from "./imports/settings.js";
import { reactiveLocalStorage } from "./imports/storage.js";
import { chunk_text, chunk_html } from "./imports/chunk_text.js";
import { confirm } from "./imports/modal.js";
import isVisible from "/client/imports/visible.js";
import Favico from "favico.js";
import { hsize } from "/client/imports/ui/components/splitter/splitter.js";
import {
  selectionWithin,
  selectWithin,
  textContent,
} from "./imports/contenteditable_selection.js";

const GENERAL_ROOM = GENERAL_ROOM_NAME;
const GENERAL_ROOM_REGEX = new RegExp(`^${GENERAL_ROOM}$`, "i");

Session.setDefault({
  room_name: "general/0",
  type: "general",
  id: "0",
  chatReady: false,
  limit: INITIAL_CHAT_LIMIT,
});

// Chat helpers!

function assignMessageFollowup(curr, prev) {
  if (!(curr instanceof Element)) {
    return prev;
  }
  if (!curr.classList.contains("media")) {
    return curr;
  }
  if (prev === undefined) {
    prev = curr.previousElementSibling;
  }
  if (prev != null) {
    if (!(prev instanceof Element)) {
      prev = prev.previousElementSibling;
    }
  }
  if (computeMessageFollowup(prev, curr)) {
    curr.classList.add("bb-message-followup");
  } else {
    curr.classList.remove("bb-message-followup");
  }
  return curr;
}

function assignMessageFollowupList(nodeList) {
  let prev =
    nodeList.length > 0 ? nodeList[0].previousElementSibling : undefined;
  for (let n of nodeList) {
    if (n instanceof Element) {
      prev = assignMessageFollowup(n, prev);
      assignReadMarker(n);
    }
  }
  return prev;
}

function assignReadMarker(element) {
  if (element.dataset.read !== "read") {
    return;
  }
  if (element.nextElementSibling?.dataset?.read !== "unread") {
    return;
  }
  return $(instachat.readMarker).insertAfter(element);
}

// Globals
var instachat = {};
instachat["alertWhenUnreadMessages"] = false;
instachat["scrolledToBottom"] = true;
instachat["readMarker"] = $('<div class="bb-message-last-read">read</div>');
instachat["mutationObserver"] = new MutationObserver(function (recs, obs) {
  for (let rec of recs) {
    // previous element's followup status can't be affected by changes after it;
    assignMessageFollowupList(rec.addedNodes);
    let nextEl = rec.nextSibling;
    if (nextEl != null && !(nextEl instanceof Element)) {
      nextEl = nextEl.nextElementSibling;
    }
    assignMessageFollowup(nextEl);
  }
});
instachat["readObserver"] = new MutationObserver((recs, obs) =>
  recs.map((rec) => assignReadMarker(rec.target))
);

// Favicon instance, used for notifications
// (first add host to path)
const favicon = new Favico({
  animation: "slide",
  fontFamily: "Noto Sans",
  fontStyle: "700",
});

Template.chat.helpers({
  object() {
    const type = Session.get("type");
    return type !== "general" && collection(type)?.findOne(Session.get("id"));
  },
});

function starred_messages_room() {
  return Template.currentData().room_name ?? Session.get("room_name");
}

Template.starred_messages.onCreated(function () {
  this.autorun(() => {
    this.subscribe("starred-messages", starred_messages_room());
  });
});

Template.starred_messages.helpers({
  messages() {
    return Messages.find(
      { room_name: starred_messages_room(), starred: true },
      {
        sort: [["timestamp", "asc"]],
        transform: messageTransform(Template.currentData().canModify),
      }
    );
  },
});

Template.media_message.events({
  "click .bb-message.starred .bb-message-star"(event, template) {
    if ($(event.target).closest(".can-modify-star").size() <= 0) {
      return;
    }
    Meteor.serializeCall("setStarred", this._id, false);
  },
  "click .bb-message:not(.starred) .bb-message-star"(event, template) {
    if ($(event.target).closest(".can-modify-star").size() <= 0) {
      return;
    }
    Meteor.serializeCall("setStarred", this._id, true);
  },
});

Template.message_delete_button.events({
  async "click .bb-delete-message"(event, template) {
    if (
      await confirm({
        ok_button: "Yes, delete it",
        no_button: "No, cancel",
        message: "Really delete this message?",
      })
    ) {
      Meteor.serializeCall("deleteMessage", this._id);
    }
  },
});

Template.poll.onCreated(function () {
  this.show_votes = new ReactiveVar(false);
  this.autorun(() => {
    this.subscribe("poll", Template.currentData());
  });
});

Template.poll.helpers({
  show_votes() {
    return Template.instance().show_votes.get();
  },
  options() {
    let canon, p;
    const poll = Polls.findOne(Template.currentData());
    if (poll == null) {
      return;
    }
    const votes = {};
    const myVote = poll.votes[Meteor.userId()]?.canon;
    for (p of poll.options) {
      votes[p.canon] = [];
    }
    for (let voter in poll.votes) {
      const vote = poll.votes[voter];
      votes[vote.canon].push({ _id: voter, timestamp: vote.timestamp });
    }
    let max = 1;
    for (canon in votes) {
      const voters = votes[canon];
      if (voters.length > max) {
        max = voters.length;
      }
    }
    const result = [];
    for (p of poll.options) {
      votes[p.canon].sort((a, b) => a.timestamp - b.timestamp);
      result.push({
        _id: p.canon,
        text: p.option,
        votes: votes[p.canon],
        width: (100 * votes[p.canon].length) / max,
        yours: myVote === p.canon,
        leading: votes[p.canon].length >= max,
      });
    }
    return result;
  },
});

Template.poll.events({
  "click button[data-option]"(event, template) {
    Meteor.serializeCall("vote", template.data, event.target.dataset.option);
  },
  "click button.toggle-votes"(event, template) {
    template.show_votes.set(!template.show_votes.get());
  },
});

function messageTransform(canModifyStar) {
  return function (m) {
    return {
      _id: m._id,
      message: m,
      canModifyStar,

      read() {
        // Since a message can go from unread to read, but never the other way,
        // use a nonreactive read at first. If it's unread, then do a reactive read
        // to create the tracker dependency.
        const result = Tracker.nonreactive(
          () => m.timestamp <= Session.get("lastread")
        );
        if (!result) {
          Session.get("lastread");
        }
        return result;
      },
    };
  };
}

// Template Binding
Template.messages.helpers({
  ready() {
    return (
      Session.equals("chatReady", true) &&
      Template.instance().subscriptionsReady()
    );
  },
  // The dawn of time message has ID equal to the room name because it's
  // efficient to find it that way on the client, where there are no indexes.
  startOfChannel() {
    return (
      Messages.findOne({
        _id: Session.get("room_name", { from_chat_subscription: true }),
      }) != null
    );
  },
  usefulEnough(m) {
    // test Session.get('nobot') last to get a fine-grained dependency
    // on the `nobot` session variable only for 'useless' messages
    const myNick = Meteor.userId();
    const botnick = botuser()?._id;
    if (m.nick === myNick) {
      return true;
    }
    if (doesMentionNick(m)) {
      return true;
    }
    if (m.useful) {
      return true;
    }
    if (m.tweet == null && m.nick !== botnick && !m.useless_cmd) {
      return true;
    }
    return !HIDE_USELESS_BOT_MESSAGES.get();
  },
  messages() {
    if (!Template.instance().waitForObservers.get()) {
      return [];
    }
    const room_name = Session.get("room_name");
    // I will go out on a limb and say we need this because transform uses
    // doesMentionNick and transforms aren't usually reactive, so we need to
    // recompute them if you log in as someone else.
    Meteor.userId();
    return Messages.find(
      { room_name, from_chat_subscription: true },
      {
        sort: [["timestamp", "asc"]],
        transform: messageTransform(true),
      }
    );
  },
});

let selfScroll = null;

function touchSelfScroll() {
  if (selfScroll != null) {
    Meteor.clearTimeout(selfScroll);
  }
  selfScroll = Meteor.setTimeout(() => (selfScroll = null), 1000); // ignore browser-generated scroll events for 1 (more) second
}

Template.messages.helpers({
  scrollHack(m) {
    touchSelfScroll(); // ignore scroll events caused by DOM update
    return maybeScrollMessagesView();
  },
  whos_typing() {
    return Presence.find({
      room_name: Session.get("room_name"),
      scope: "typing",
      nick: { $ne: Meteor.userId() },
    });
  },
});

function cleanupChat() {
  try {
    favicon.reset();
  } catch (error) {}
  instachat.mutationObserver?.disconnect();
  instachat.readObserver?.disconnect();
  instachat.bottomObserver?.disconnect();
  instachat.resizeObserver?.disconnect();
}

Template.messages.onDestroyed(function () {
  cleanupChat();
  hideMessageAlert();
});

// window.unload is a bit spotty with async stuff, but we might as well try
$(window).unload(() => cleanupChat());

Template.messages.onCreated(function () {
  this.waitForObservers = new ReactiveVar(false);
  instachat.scrolledToBottom = true;
  this.autorun(() => {
    // put this in a separate autorun so it's not invalidated needlessly when
    // the limit changes.
    const room_name = Session.get("room_name");
    if (!room_name) {
      return;
    }
    this.subscribe("register-presence", room_name, "chat");
  });

  this.autorun(() => {
    const invalidator = function () {
      instachat.ready = false;
      Session.set("chatReady", false);
      hideMessageAlert();
    };
    invalidator();
    const room_name = Session.get("room_name");
    if (!room_name) {
      return;
    }
    // load messages for this page
    const onReady = () => {
      instachat.ready = true;
      Session.set("chatReady", true);
      if (this.limitRaise != null) {
        let firstMessage, offset;
        [[firstMessage, offset], this.limitRaise] = [
          this.limitRaise,
          undefined,
        ];
        Tracker.afterFlush(() => {
          // only scroll if the button is visible, since it means we were at the
          // top and are still there. If we were anywhere else, the window would
          // have stayed put.
          const messages = this.$("#messages")[0];
          const chatStart = this.$(".bb-chat-load-more, .bb-chat-start")[0];
          if (chatStart.getBoundingClientRect().bottom <= messages.offsetTop) {
            return;
          }
          // We can't just scroll the last new thing into view because of the header.
          // we have to find the thing whose offset top is as much above the message
          // we want to keep in view as the offset top of the messages element.
          // We would have to loop to find firstMessage's index in messages.children,
          // so just iterate backwards. Shouldn't take too long to find ~100 pixels.
          let currMessage = firstMessage;
          while (
            currMessage != null &&
            firstMessage.offsetTop - currMessage.offsetTop < offset
          ) {
            currMessage = currMessage.previousElementSibling;
          }
          currMessage?.scrollIntoView();
        });
      } else {
        Tracker.afterFlush(() => {
          this.$(
            `.bb-message[data-read=\"unread\"]:is(.bb-message-mention-me,[data-pm-to=\"${Meteor.userId}\"])`
          )[0]?.scrollIntoView();
        });
      }
    };
    this.subscribe("recent-messages", room_name, Session.get("limit"), {
      onReady,
    });
    Tracker.onInvalidate(invalidator);
  });
});

Template.messages.onRendered(function () {
  const parent = this.view.firstNode()?.parentElement;
  if (parent) {
    instachat.resizeObserver = new ResizeObserver(function () {
      maybeScrollMessagesView();
    });
    instachat.resizeObserver.observe(parent);
  }
  const chatBottom = document.getElementById("chat-bottom");
  instachat.bottomObserver = new IntersectionObserver(function (entries) {
    if (selfScroll != null) {
      return;
    }
    instachat.scrolledToBottom = entries[0].isIntersecting;
  });
  instachat.bottomObserver.observe(chatBottom);
  // observe future changes
  this.$("#messages").each(function () {
    instachat.mutationObserver.observe(this, { childList: true });
  });

  this.$("#messages").each(function () {
    instachat.readObserver.observe(this, {
      attributes: true,
      attributeFilter: ["data-read"],
      subtree: true,
    });
  });

  Meteor.defer(() => this.waitForObservers.set(true));
});

Template.messages.events({
  "click .bb-chat-load-more"(event, template) {
    const firstMessage = event.currentTarget.nextElementSibling;
    const offset = firstMessage.offsetTop;
    template.limitRaise = [firstMessage, offset];
    Session.set("limit", Session.get("limit") + CHAT_LIMIT_INCREMENT);
  },
});

function whos_here_helper() {
  const roomName = Session.get("room_name");
  return Presence.find(
    { room_name: roomName, scope: "chat" },
    { sort: ["joined_timestamp"] }
  );
}

Template.embedded_chat.onCreated(function () {
  this.jitsi = new ReactiveVar(null);
  this.jitsiReady = new ReactiveVar(false);
  // Intentionally staying out of the meeting.
  this.jitsiLeft = new ReactiveVar(false);
  this.jitsiPinType = new ReactiveVar(null);
  this.jitsiPinId = new ReactiveVar(null);
  this.jitsiType = function () {
    return this.jitsiPinType.get() ?? Session.get("type");
  };
  this.jitsiId = function () {
    return this.jitsiPinId.get() ?? Session.get("id");
  };
  this.jitsiInOtherTab = function () {
    const jitsiTabUUID = reactiveLocalStorage.getItem("jitsiTabUUID");
    return jitsiTabUUID != null && jitsiTabUUID !== CLIENT_UUID;
  };
  this.leaveJitsi = function () {
    this.jitsiLeft.set(true);
    this.jitsi.get()?.dispose();
    this.jitsi.set(null);
    this.jitsiPinType.set(null);
    this.jitsiPinId.set(null);
    this.jitsiRoom = null;
    this.jitsiReady.set(false);
  };
  this.unsetCurrentJitsi = function () {
    if (CLIENT_UUID === reactiveLocalStorage.getItem("jitsiTabUUID")) {
      reactiveLocalStorage.removeItem("jitsiTabUUID");
    }
  };
  $(window).on("unload", this.unsetCurrentJitsi);
});

function jitsiRoomSubject(type, id) {
  if ("puzzles" === type) {
    return Puzzles.findOne(id).name ?? "Puzzle";
  } else if ("0" === id) {
    return GENERAL_ROOM_NAME;
  } else {
    return "Video Call";
  }
}

Template.embedded_chat.onRendered(function () {
  this.autorun(() => {
    if (this.jitsiLeft.get()) {
      return;
    }
    if (this.jitsiInOtherTab()) {
      this.leaveJitsi();
      return;
    }
    const newRoom = jitsiRoom(this.jitsiType(), this.jitsiId());
    let jitsi = this.jitsi.get();
    if (jitsi != null && newRoom !== this.jitsiRoom) {
      jitsi.dispose();
      jitsi = null;
      this.jitsi.set(null);
      this.jitsiRoom = null;
      this.jitsiReady.set(false);
    }
    if (newRoom != null) {
      this.subscribe("jitsi-jwt", newRoom);
      if (jitsi == null) {
        jitsi = jitsiModule.createJitsiMeet(
          newRoom,
          this.find("#bb-jitsi-container")
        );
        if (jitsi == null) {
          return;
        }
        this.jitsiRoom = newRoom;
        this.jitsi.set(jitsi);
        jitsi.once("videoConferenceJoined", ({ id }) => {
          const myId = id;
          if (this.jitsi.get() !== jitsi) {
            return;
          }
          this.jitsiReady.set(true);
          jitsi.on("participantRoleChanged", ({ id, role }) => {
            if (id === myId && role === "moderator") {
              try {
                jitsi.executeCommand(
                  "subject",
                  Tracker.nonreactive(() =>
                    jitsiRoomSubject(this.jitsiType(), this.jitsiId())
                  )
                );
              } catch (error) {
                console.log(error);
              }
            }
          });
        });
        jitsi.once("videoConferenceLeft", () => {
          this.leaveJitsi();
          reactiveLocalStorage.removeItem("jitsiTabUUID");
        });
        reactiveLocalStorage.setItem("jitsiTabUUID", CLIENT_UUID);
      }
      this.subscribe(
        "register-presence",
        `${this.jitsiType()}/${this.jitsiId()}`,
        "jitsi"
      );
    }
  });
  // If you reload the page the content of the user document won't be loaded yet.
  // The check that newroom is different from the current room means the display
  // name won't be set yet. This allows the display name and avatar to be set when
  // they become available. (It also updates them if they change.)
  this.autorun(() => {
    const user = Meteor.user();
    const jitsi = this.jitsi.get();
    if (jitsi == null) {
      return;
    }
    if (!this.jitsiReady.get()) {
      return;
    }
    jitsi.executeCommands({
      displayName: nickAndName(user),
      avatarUrl: gravatarUrl({
        gravatar_md5: hashFromNickObject(user),
        size: 200,
      }),
    });
  });
  // The moderator should set the conference subject.
  this.autorun(() => {
    const jitsi = this.jitsi.get();
    if (jitsi == null) {
      return;
    }
    if (!this.jitsiReady.get()) {
      return;
    }
    try {
      jitsi.executeCommand(
        "subject",
        jitsiRoomSubject(this.jitsiType(), this.jitsiId())
      );
    } catch (error) {}
  });
});

Template.embedded_chat.onDestroyed(function () {
  this.unsetCurrentJitsi();
  $(window).off("unload", this.unsetCurrentJitsi);
  this.jitsi.get()?.dispose();
});

Template.embedded_chat.helpers({
  inJitsi() {
    return Template.instance().jitsi.get() != null;
  },
  canJitsi() {
    return (
      jitsiRoom(Session.get("type"), Session.get("id")) != null &&
      Template.instance().jitsiLeft.get()
    );
  },
  otherJitsi() {
    return Template.instance().jitsiInOtherTab();
  },
  jitsiSize() {
    // Set up dependencies
    if (Template.instance().jitsi.get() == null) {
      return;
    }
    const sizeWouldBe = Math.floor((hsize() * 9) / 16);
    if (CAP_JITSI_HEIGHT.get()) {
      return Math.min(75, sizeWouldBe);
    }
    return sizeWouldBe;
  },
  jitsiPresence() {
    const roomName = Session.get("room_name");
    return Presence.find(
      { room_name: roomName, scope: "jitsi", nick: { $ne: Meteor.userId() } },
      { sort: ["joined_timestamp"] }
    );
  },
  jitsiPinSet() {
    return Template.instance().jitsiPinType.get() != null;
  },
  jitsiUrl() {
    return jitsiUrl(Session.get("type"), Session.get("id"));
  },
  usingJitsiPin() {
    const instance = Template.instance();
    return (
      jitsiRoom(instance.jitsiType(), instance.jitsiId()) !==
      jitsiRoom(Session.get("type"), Session.get("id"))
    );
  },
  pinnedRoomName() {
    const instance = Template.instance();
    return jitsiRoomSubject(instance.jitsiType(), instance.jitsiId());
  },
  pinnedRoomUrl() {
    const instance = Template.instance();
    if (instance.jitsiType() === "general") {
      return Meteor._relativeToSiteRootUrl("/");
    }
    return urlFor(instance.jitsiType(), instance.jitsiId());
  },
});

Template.embedded_chat.events({
  "click .bb-join-jitsi"(event, template) {
    reactiveLocalStorage.setItem("jitsiTabUUID", CLIENT_UUID);
    template.jitsiLeft.set(false);
  },
  "click .bb-pop-jitsi"(event, template) {
    template.leaveJitsi();
  },
  "click .bb-jitsi-pin"(event, template) {
    template.jitsiPinType.set(Session.get("type"));
    template.jitsiPinId.set(Session.get("id"));
  },
  "click .bb-jitsi-unpin"(event, template) {
    template.jitsiPinType.set(null);
    template.jitsiPinId.set(null);
  },
  "click .bb-jitsi-cap-height:not(.capped)"(event, template) {
    CAP_JITSI_HEIGHT.set(true);
  },
  "click .bb-jitsi-cap-height.capped"(event, template) {
    CAP_JITSI_HEIGHT.set(false);
  },
});

// Utility functions

const GLOBAL_MENTIONS = /@(channel|everyone)/i;

function doesMentionNick(doc, raw_nick = Meteor.userId()) {
  if (!raw_nick) {
    return false;
  }
  const nick = canonical(raw_nick);
  if (nick === doc.nick) {
    return false;
  } // messages from yourself don't count
  if (doc.to === nick) {
    return true;
  } // PMs to you count
  if (doc.mention?.includes(nick)) {
    return true;
  } // Mentions count
  if (doc.body == null) {
    return false;
  }
  if (doc.system) {
    return false;
  } // system messages don't count as mentions
  if (doc.bodyIsHtml) {
    return false;
  } // XXX we could fix this
  // These things are treated as mentions for everyone
  return GLOBAL_MENTIONS.test(doc.body);
}

function prettyRoomName() {
  const type = Session.get("type");
  const id = Session.get("id");
  const name = type === "general" ? GENERAL_ROOM : Names.findOne(id)?.name;
  return name || "unknown";
}

function joinRoom(type, id) {
  goToChat(type, id);
  Tracker.afterFlush(() => scrollMessagesView());
  $("#messageInput").select();
}

let pendingScrollMessagesView = false;
function maybeScrollMessagesView() {
  if (!instachat.scrolledToBottom || !!pendingScrollMessagesView) {
    return;
  }
  pendingScrollMessagesView = true;
  Tracker.afterFlush(function () {
    pendingScrollMessagesView = false;
    scrollMessagesView();
  });
}

function scrollMessagesView() {
  touchSelfScroll();
  instachat.scrolledToBottom = true;
  const last = document
    ?.querySelector?.("#messages > *:last-child")
    ?.scrollIntoView();
  // the scroll handler below will reset scrolledToBottom to be false
  instachat.scrolledToBottom = true;
}

// ensure that we stay stuck to bottom even after images load
function imageScrollHack(img) {
  touchSelfScroll(); // ignore scroll event generated by image resize
  if (img?.classList != null) {
    img.classList.remove("image-loading");
  }
  maybeScrollMessagesView();
}
window.imageScrollHack = imageScrollHack;
// note that image load does not delegate, so we can't use it here in
// a document-wide "live" event handler

Template.media_message.events({
  "mouseenter .bb-message-body .inline-image"(event, template) {
    imageScrollHack(event.currentTarget);
  },
});

Template.chat_format_body.helpers({
  chunks() {
    if (this.bodyIsHtml) {
      return chunk_html(this.body);
    } else {
      return chunk_text(this.body);
    }
  },
  chunk_template(type) {
    if (type === "url") {
      return "text_chunk_url_image";
    } else {
      return `text_chunk_${type}`;
    }
  },
});

Template.messages_input.helpers({
  whos_here: whos_here_helper,
  typeaheadResults() {
    return Template.instance().queryCursor.get();
  },
  selected(id) {
    return Template.instance().selected.get() === id;
  },
  queryType() {
    return Template.instance().queryType.get();
  },
  error() {
    return Template.instance().error.get();
  },
});

const MSG_PATTERN = /^\/m(sg)? ([A-Za-z_0-9]*)$/;
const MSG_AT_START_PATTERN = /^\/m(sg)? /;
const AT_MENTION_PATTERN = /(^|[\s])@([A-Za-z_0-9]*)$/;
const ROOM_MENTION_PATTERN = /(^|[\s])#([A-Za-z_0-9/]*)$/;

Template.messages_presence.onRendered(function () {
  this.hideHandle = Meteor.setTimeout(() => {
    this.$(".inner-nick").animate({ width: "toggle" }, "fast");
    delete this.hideHandle;
  }, 5000);
});

Template.messages_presence.onDestroyed(function () {
  if (this.hideHandle) {
    Meteor.clearTimeout(this.hideHandle);
  }
});

Template.messages_input.onCreated(function () {
  this.autorun(() => {
    const room_name = Session.get("room_name");
    if (!room_name) {
      return;
    }
    this.subscribe("presence-for-room", room_name);
  });

  this.query = new ReactiveVar(null);
  this.queryType = new ReactiveVar(null);
  this.queryCursor = new ReactiveVar(null);
  this.selected = new ReactiveVar(null);
  this.error = new ReactiveVar(null);
  this.typing = new ReactiveVar(null);

  this.autorun(() => {
    const room_name = Session.get("room_name");
    if (!room_name) {
      return;
    }
    if (this.typing.get() > Session.get("currentTime") - 60000) {
      this.subscribe("register-presence", room_name, "typing");
    }
  });

  this.setQuery = function (query, type) {
    if (this.query.get() === query && this.queryType.get() === type) {
      return;
    }
    this.query.set(query);
    this.queryType.set(type);
    if (query == null) {
      this.queryCursor.set(null);
      this.selected.set(null);
      return;
    }
    let c, l;
    switch (type) {
      case "users":
        const qdoc = { $regex: query, $options: "i" };
        c = Meteor.users.find(
          { $or: [{ _id: qdoc }, { real_name: qdoc }] },
          {
            limit: 8,
            fields: { _id: 1 },
            sort: { roles: -1, _id: 1 },
          }
        );
        l = c.map((x) => x._id);
        break;
      case "rooms":
        let orList;
        const [type, id] = query.split("/", 2);
        if (!id) {
          orList = [
            { type: { $regex: type, $options: "i" } },
            {
              type: { $in: ["rounds", "puzzles"] },
              name: { $regex: type, $options: "i" },
            },
          ];
        } else {
          orList = [
            { type, _id: { $regex: id } },
            { type, name: { $regex: id, $options: "i" } },
          ];
        }
        c = Names.find(
          { $or: orList },
          {
            limit: 8,
            sort: { name: 1, _id: 1 },
          }
        );
        l = c.map((x) => `${x.type}/${x._id}`);
        break;
      /* istanbul ignore next */
      default:
        return;
    }
    this.queryCursor.set(c);
    const s = this.selected.get();
    if (l.includes(s)) {
      return;
    }
    this.selected.set(l[0]);
  };

  this.moveActive = (offset) => {
    const s = this.selected.get();
    if (s == null) {
      return;
    }
    const c = this.queryCursor.get();
    if (c == null) {
      return;
    }
    let l;
    switch (this.queryType.get()) {
      case "users":
        l = c.map((x) => x._id);
        break;
      case "rooms":
        l = c.map((x) => `${x.type}/${x._id}`);
        break;
      /* istanbul ignore next*/
      default:
        return;
    }
    let i = offset + l.indexOf(s);
    if (i < 0) {
      i = l.length - 1;
    }
    if (i >= l.length) {
      i = 0;
    }
    this.selected.set(l[i]);
  };

  this.autorun(() => {
    const c = this.queryCursor.get();
    if (!c) {
      return;
    }
    c.observe({
      removedAt: (old, at) => {
        if (this.selected.get() === old._id) {
          return this.activateFirst();
        }
      },
    });
  });

  this.activateFirst = function () {
    const c = this.queryCursor.get();
    if (!c) {
      this.selected.set(null);
      return;
    }
    const id = c.fetch()[0];
    switch (this.queryType.get()) {
      case "users":
        this.selected.set(id?._id);
        break;
      case "rooms":
        this.selected.set(id ? `${id.type}/${id._id}` : null);
        break;
      /* istanbul ignore next */
      default:
    }
  };

  this.updateTypeahead = function () {
    const i = this.$("#messageInput");
    const selection = selectionWithin(i[0]);
    if (selection === null) {
      return;
    }
    if (selection[0] !== selection[1]) {
      this.setQuery(null, null);
      return;
    }
    const position = selection[0];
    const v = textContent(i[0]);
    const tv = v.substring(position);
    const nextSpace = tv.search(/[\s]/);
    const consider =
      nextSpace === -1 ? v : v.substring(0, position + nextSpace);
    let match = consider.match(MSG_PATTERN);
    if (match) {
      this.setQuery(match[2], "users");
      return;
    }
    match = consider.match(ROOM_MENTION_PATTERN);
    if (match) {
      this.setQuery(match[2], "rooms");
      return;
    }
    if (MSG_AT_START_PATTERN.test(v)) {
      // no mentions in private messages.
      this.setQuery(null, null);
      return;
    }
    match = consider.match(AT_MENTION_PATTERN);
    if (match) {
      this.setQuery(match[2], "users");
      return;
    }
    this.setQuery(null, null);
  };

  this.confirmTypeahead = function (nick) {
    let newCaret;
    this.setQuery(null, null);
    const i = this.$("#messageInput");
    const selection = selectionWithin(i[0]);
    if (selection === null) {
      return;
    }
    const v = textContent(i[0]);
    const ss = selection[0];
    const tv = v.substring(ss);
    const nextSpace = tv.search(/[\s]/);
    const consider = nextSpace === -1 ? v : v.substring(0, ss + nextSpace);
    let match = consider.match(MSG_PATTERN);
    if (match) {
      i.prop(
        "innerText",
        v.substring(0, match[0].length - match[2].length) +
          nick +
          " " +
          v.substring(consider.length)
      );
      newCaret = match[0].length - match[2].length + nick.length + 1;
      selectWithin(i[0], newCaret);
      i.focus();
      return;
    }
    for (const pattern of [AT_MENTION_PATTERN, ROOM_MENTION_PATTERN]) {
      match = consider.match(pattern);
      if (match) {
        i.prop(
          "innerText",
          v.substring(0, consider.length - match[2].length) +
            nick +
            " " +
            v.substring(consider.length)
        );
        newCaret = consider.length - match[2].length + nick.length + 1;
        selectWithin(i[0], newCaret);
        i.blur();
        i.focus();
        return;
      }
    }
  };

  this.submit = function (message) {
    this.typing.set(null);
    let to;
    let n;
    if (!message?.trim().length) {
      return false;
    }
    const args = {
      room_name: Session.get("room_name"),
      body: message,
    };
    let [word1, rest] = message.split(/\s+([^]*)/, 2);
    switch (word1) {
      case "/me":
        args.body = rest;
        args.action = true;
        break;
      case "/join":
        var result = Names.findOne({
          canon: canonical(rest.trim()),
          type: { $in: ["rounds", "puzzles"] },
        });
        if (result == null && GENERAL_ROOM_REGEX.test(rest.trim())) {
          result = { type: "general", _id: "0" };
        }
        if (error != null || result == null) {
          this.error.set("unknown chat room");
          return false;
        }
        hideMessageAlert();
        joinRoom(result.type, result._id);
        return true;
      case "/msg":
      case "/m":
        // find who it's to
        [to, rest] = rest.split(/\s+([^]*)/, 2);
        var missingMessage = !rest;
        while (rest) {
          let extra;
          n = Meteor.users.findOne(canonical(to));
          if (n) {
            break;
          }
          if (to === "bot") {
            // allow 'bot' as a shorthand for 'codexbot'
            const bot = botuser();
            if (bot) {
              to = bot._id;
              continue;
            }
          }
          [extra, rest] = rest.split(/\s+([^]*)/, 2);
          to += " " + extra;
        }
        if (n) {
          args.body = rest;
          args.to = to;
        } else {
          var error = missingMessage
            ? "tried to say nothing"
            : "Unknown recipient";
          this.error.set(error);
          return false;
        }
        break;
    }
    if (args.to == null) {
      // Can't mention someone in a private message
      const mentions = [];
      for (let match of args.body.matchAll(
        /(^|[\s])@([a-zA-Z_0-9]*)([\s.?!,]|$)/g
      )) {
        const canon = canonical(match[2]);
        if (Meteor.users.findOne(canon) == null) {
          continue;
        }
        mentions.push(canon);
      }
      if (mentions.length) {
        args.mention = mentions;
      }
    }
    Meteor.serializeCall("newMessage", args); // updates LastRead as a side-effect
    // for flicker prevention, we are currently not doing latency-compensation
    // on the newMessage call, which makes the below ineffective.  But leave
    // it here in case we turn latency compensation back on.
    Tracker.afterFlush(() => scrollMessagesView());
    this.history_ts = null;
    return true;
  };
});

function format_body(msg) {
  if (msg.action) {
    return `/me ${msg.body}`;
  }
  if (msg.to != null) {
    return `/msg ${msg.to} ${msg.body}`;
  }
  return msg.body;
}

Template.messages_input.events({
  "keydown #messageInput"(event, template) {
    let msg, query, s;
    template.error.set(null);
    if (["Up", "ArrowUp"].includes(event.key)) {
      if (template.query.get() != null) {
        event.preventDefault();
        template.moveActive(-1);
      } else if (selectionWithin(event.target)?.[1] === 0) {
        // Checking that the cursor is at the start of the box.
        query = {
          room_name: Session.get("room_name"),
          nick: Meteor.userId(),
          system: { $ne: true },
          bodyIsHtml: { $ne: true },
          from_chat_subscription: true,
          on_behalf: { $ne: true },
        };
        if (template.history_ts != null) {
          query.timestamp = { $lt: template.history_ts };
        }
        msg = Messages.findOne(query, { sort: { timestamp: -1 } });
        if (msg != null) {
          template.history_ts = msg.timestamp;
          event.target.innerText = format_body(msg);
          selectWithin(event.target, 0);
        }
        return;
      }
    }
    if (["Down", "ArrowDown"].includes(event.key)) {
      if (template.query.get() != null) {
        event.preventDefault();
        template.moveActive(1);
      } else if (
        selectionWithin(event.target)?.[0] === textContent(event.target).length
      ) {
        // 40 is arrow down. Checking that the cursor is at the end of the box.
        if (template.history_ts == null) {
          return;
        }
        // Pushing down only means anything if you're in history.
        query = {
          room_name: Session.get("room_name"),
          nick: Meteor.userId(),
          system: { $ne: true },
          bodyIsHtml: { $ne: true },
          timestamp: { $gt: template.history_ts },
          from_chat_subscription: true,
          on_behalf: { $ne: true },
        };
        msg = Messages.findOne(query, { sort: { timestamp: 1 } });
        if (msg != null) {
          template.history_ts = msg.timestamp;
          const body = format_body(msg);
          event.target.innerText = body;
          selectWithin(event.target, body.length);
        } else {
          template.typing.set(null);
          event.target.innerText = "";
          template.history_ts = null;
        }
        return;
      }
    }

    if (event.which === 13 && !(event.shiftKey || event.ctrlKey)) {
      event.preventDefault(); // prevent insertion of enter
      s = template.selected.get();
      if (s != null) {
        // Autocomplete if relevant.
        template.confirmTypeahead(s);
      } else {
        // implicit submit on enter (but not shift-enter or ctrl-enter)
        const $message = $(event.currentTarget);
        const message = textContent($message[0]);
        if (template.submit(message)) {
          $message.prop("innerText", "");
        }
      }
    }

    // Tab also autocompletes
    if (event.key === "Tab") {
      s = template.selected.get();
      if (s != null) {
        event.preventDefault();
        template.confirmTypeahead(s);
      }
    }
  },

  "blur #messageInput"(event, template) {
    // alert for unread messages
    instachat.alertWhenUnreadMessages = true;
  },
  "focus #messageInput"(event, template) {
    if (instachat.ready) {
      updateLastRead();
    } // skip during initial load
    instachat.alertWhenUnreadMessages = false;
    hideMessageAlert();
  },
  "input #messageInput"(event, template) {
    const minChars = TypingIndicatorCharacters.get();
    const value = textContent(event.currentTarget);
    let time = null;
    if (
      minChars > 0 &&
      value.length >= minChars &&
      !value.startsWith("/msg ")
    ) {
      time = Date.now();
    }
    template.typing.set(time);
  },
  "keyup/click/touchend/mouseup #messageInput"(event, template) {
    template.updateTypeahead();
  },
  "click #messageInputTypeahead a[data-value]"(event, template) {
    event.preventDefault();
    template.confirmTypeahead(event.currentTarget.dataset.value);
  },
  "mouseenter #messageInputTypeahead"(event, template) {
    template.selected.set(null);
  },
  "mouseleave #messageInputTypeahead"(event, template) {
    template.activateFirst();
  },
});

var updateLastRead = function () {
  const lastMessage = Messages.findOne(
    {
      room_name: Session.get("room_name"),
      from_chat_subscription: true,
    },
    { sort: [["timestamp", "desc"]] }
  );
  if (!lastMessage) {
    return;
  }
  Meteor.serializeCall("updateLastRead", {
    room_name: Session.get("room_name"),
    timestamp: lastMessage.timestamp,
  });
};

function hideMessageAlert() {
  updateNotice(0, 0);
}

Template.chat.onCreated(function () {
  this.autorun(() => $("title").text("Chat: " + prettyRoomName()));
  this.autorun(function () {
    if (isVisible() && instachat.ready) {
      updateLastRead();
    }
  });
});

Template.chat.onRendered(function () {
  $(window).resize();
  const type = Session.get("type");
  const id = Session.get("id");
  joinRoom(type, id);
});

// App startup
Meteor.startup(function () {
  instachat.messageMentionSound = new Audio(
    Meteor._relativeToSiteRootUrl("/sound/Electro_-S_Bainbr-7955.wav")
  );
});

let [lastUnread, lastMention] = [0, 0];
const updateNotice = _.debounce(function (unread, mention) {
  if (mention > lastMention && instachat.ready) {
    if (!MUTE_SOUND_EFFECTS.get()) {
      instachat.messageMentionSound
        ?.play?.()
        ?.catch?.((err) => console.error(err.message, err));
    }
  }
  // update title and favicon
  if (mention > 0) {
    if (mention !== lastMention) {
      favicon.badge(mention, { bgColor: "#00f" });
    }
  } else {
    if (unread !== lastUnread) {
      favicon.badge(unread, { bgColor: "#000" });
    }
  }
  //# XXX check instachat.ready and instachat.alertWhenUnreadMessages ?
  [lastUnread, lastMention] = [unread, mention];
}, 100);

Template.messages.onCreated(function () {
  this.autorun(function () {
    const nick = Meteor.userId() || "";
    const room_name = Session.get("room_name");
    if (!nick || !room_name) {
      Session.set("lastread", undefined);
      hideMessageAlert();
      return;
    }
    Tracker.onInvalidate(hideMessageAlert);
    // watch the last read and update the session
    const lastread = LastRead.findOne(room_name);
    if (!lastread) {
      Session.set("lastread", undefined);
      hideMessageAlert();
      return;
    }
    Session.set("lastread", lastread.timestamp);
    // watch the unread messages
    let total_unread = 0;
    let total_mentions = 0;
    let update = function () {}; // ignore initial updates
    function added(item) {
      if (item.system) {
        return;
      }
      total_unread++;
      if (doesMentionNick(item)) {
        total_mentions++;
      }
    }
    function removed(item) {
      if (item.system) {
        return;
      }
      total_unread--;
      if (doesMentionNick(item)) {
        total_mentions--;
      }
    }
    Messages.find({
      room_name,
      nick: { $ne: nick },
      timestamp: { $gt: lastread.timestamp },
      from_chat_subscription: true,
    }).observe({
      added(item) {
        added(item);
        update();
      },
      removed(item) {
        removed(item);
        update();
      },
      changed(newItem, oldItem) {
        removed(oldItem);
        added(newItem);
        update();
      },
    });
    // after initial query is processed, handle updates
    update = () => updateNotice(total_unread, total_mentions);
    update();
  });
});

// evil hack to workaround scroll issues.
(function () {
  const f = function () {
    if (!Session.equals("currentPage", "chat")) {
      return;
    }
    return maybeScrollMessagesView();
  };
  return Meteor.setTimeout(f, 5000);
})();
