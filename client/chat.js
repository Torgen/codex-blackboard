// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import Router from '/client/imports/router.coffee';
// Cannot destructure for testing purposes.
import jitsiModule, {jitsiUrl, jitsiRoom} from './imports/jitsi.coffee';
import { gravatarUrl, hashFromNickObject, nickAndName } from './imports/nickEmail.coffee';
import { computeMessageFollowup } from './imports/followup.coffee';
import botuser from './imports/botuser.coffee';
import canonical from '/lib/imports/canonical.coffee';
import { LastRead, Messages, Names, Polls, Presence, Puzzles, collection } from '/lib/imports/collections.coffee';
import { CHAT_LIMIT_INCREMENT, CLIENT_UUID, FOLLOWUP_STYLE, GENERAL_ROOM_NAME, INITIAL_CHAT_LIMIT } from '/client/imports/server_settings.coffee';
import { CAP_JITSI_HEIGHT, HIDE_OLD_PRESENCE, HIDE_USELESS_BOT_MESSAGES, MUTE_SOUND_EFFECTS } from './imports/settings.coffee';
import { reactiveLocalStorage } from './imports/storage.coffee';
import {chunk_text, chunk_html} from './imports/chunk_text.coffee';
import { confirm } from './imports/modal.coffee';
import isVisible from '/client/imports/visible.coffee';
import Favico from 'favico.js';
import { hsize } from '/client/imports/ui/components/splitter/splitter.coffee';

const GENERAL_ROOM = GENERAL_ROOM_NAME;
const GENERAL_ROOM_REGEX = new RegExp(`^${GENERAL_ROOM}$`, 'i');

Session.setDefault({
  room_name: 'general/0',
  type:      'general',
  id:        '0',
  chatReady: false,
  limit:     INITIAL_CHAT_LIMIT
});

// Chat helpers!

const assignMessageFollowup = function(curr, prev) {
  if (!(curr instanceof Element)) { return prev; }
  if (!curr.classList.contains('media')) { return curr; }
  if (prev === undefined) {
    prev = curr.previousElementSibling;
  }
  if (prev != null) {
    if (!(prev instanceof Element)) { prev = prev.previousElementSibling; }
  }
  if (computeMessageFollowup(prev, curr)) {
    curr.classList.add("bb-message-followup");
  } else {
    curr.classList.remove("bb-message-followup");
  }
  return curr;
};

const assignMessageFollowupList = function(nodeList) {
  let prev = nodeList.length > 0 ? nodeList[0].previousElementSibling : undefined;
  for (let n of nodeList) {
    if (n instanceof Element) {
      prev = assignMessageFollowup(n, prev);
      assignReadMarker(n);
    }
  }
  return prev;
};

var assignReadMarker = function(element) {
  if (element.dataset.read !== 'read') { return; }
  if (element.nextElementSibling?.dataset?.read !== 'unread') { return; }
  return $(instachat.readMarker).insertAfter(element);
};

// Globals
var instachat = {};
instachat["UTCOffset"] = new Date().getTimezoneOffset() * 60000;
instachat["alertWhenUnreadMessages"] = false;
instachat["scrolledToBottom"]        = true;
instachat['readMarker'] = $('<div class="bb-message-last-read">read</div>');
instachat["mutationObserver"] = new MutationObserver(function(recs, obs) {
  for (let rec of recs) {
    if (!Meteor.isProduction) {
      if ([...rec.addedNodes, ...rec.removedNodes].some(x => x instanceof Element)) { console.log(rec); }
    }
    // previous element's followup status can't be affected by changes after it;
    assignMessageFollowupList(rec.addedNodes);
    let nextEl = rec.nextSibling;
    if ((nextEl != null) && !(nextEl instanceof Element)) {
      nextEl = nextEl.nextElementSibling;
    }
    assignMessageFollowup(nextEl);
  }
});
instachat["readObserver"] = new MutationObserver((recs, obs) => recs.map((rec) =>
  assignReadMarker(rec.target)));

// Favicon instance, used for notifications
// (first add host to path)
let favicon = {badge() { return false; }, reset() { return false; }};
Meteor.startup(() => favicon = new Favico({
  animation: 'slide',
  fontFamily: 'Noto Sans',
  fontStyle: '700'
}));

Template.chat.helpers({
  object() {
    const type = Session.get('type');
    return (type !== 'general') && 
      (collection(type)?.findOne(Session.get("id")));
  },
  solved() {
    const type = Session.get('type');
    return (type !== 'general') && 
      (collection(type)?.findOne(Session.get("id")))?.solved;
  }
});

const starred_messages_room = () => Template.currentData().room_name ?? Session.get('room_name');

Template.starred_messages.onCreated(function() {
  return this.autorun(() => {
    return this.subscribe('starred-messages', starred_messages_room());
  });
});

Template.starred_messages.helpers({
  messages() {
    return Messages.find({room_name: starred_messages_room(), starred: true }, {
      sort: [['timestamp', 'asc']],
      transform: messageTransform
    }
    );
  }
});

Template.media_message.events({
  'click .bb-message.starred .bb-message-star'(event, template) {
    if ($(event.target).closest('.can-modify-star').size() <= 0) { return; }
    return Meteor.call('setStarred', this._id, false);
  },
  'click .bb-message:not(.starred) .bb-message-star'(event, template) {
    if ($(event.target).closest('.can-modify-star').size() <= 0) { return; }
    return Meteor.call('setStarred', this._id, true);
  }
});

Template.message_delete_button.events({
  async 'click .bb-delete-message'(event, template) {
    if (await confirm({
      ok_button: 'Yes, delete it',
      no_button: 'No, cancel',
      message: 'Really delete this message?'
    })) {
      return Meteor.call('deleteMessage', this._id);
    }
  }
});

Template.poll.onCreated(function() {
  this.show_votes = new ReactiveVar(false);
  return this.autorun(() => {
    return this.subscribe('poll', Template.currentData());
  });
});

Template.poll.helpers({
  show_votes() { return Template.instance().show_votes.get(); },
  options() {
    let canon, p;
    const poll = Polls.findOne(this);
    if (poll == null) { return; }
    const votes = {};
    const myVote = poll.votes[Meteor.userId()]?.canon;
    for (p of poll.options) {
      votes[p.canon] = [];
    }
    for (let voter in poll.votes) {
      const vote = poll.votes[voter];
      votes[vote.canon].push({_id: voter, timestamp: vote.timestamp});
    }
    let max = 1;
    for (canon in votes) {
      const voters = votes[canon];
      if (voters.length > max) { max = voters.length; }
    }
    return (() => {
      const result = [];
      for (p of poll.options) {         result.push((
          votes[p.canon].sort((a, b) => a.timestamp - b.timestamp),{
          _id: p.canon,
          text: p.option,
          votes: votes[p.canon],
          width: (100 * votes[p.canon].length) / max,
          yours: myVote === p.canon,
          leading: votes[p.canon].length >= max
        }
        ));
      }
      return result;
    })();
  }
});

Template.poll.events({
  'click button[data-option]'(event, template) {
    return Meteor.call('vote', template.data, event.target.dataset.option);
  },
  'click button.toggle-votes'(event, template) {
    return template.show_votes.set(!template.show_votes.get());
  }
});

var messageTransform = m => ({
  _id: m._id,
  message: m,

  read() {
    // Since a message can go from unread to read, but never the other way,
    // use a nonreactive read at first. If it's unread, then do a reactive read
    // to create the tracker dependency.
    const result = Tracker.nonreactive(() => m.timestamp <= Session.get('lastread'));
    if (!result) {
      Session.get('lastread');
    }
    return result;
  }
});

// Template Binding
Template.messages.helpers({
  ready() { return Session.equals('chatReady', true) && Template.instance().subscriptionsReady(); },
  // The dawn of time message has ID equal to the room name because it's
  // efficient to find it that way on the client, where there are no indexes.
  startOfChannel() { return (Messages.findOne({_id: Session.get('room_name', {from_chat_subscription: true})}) != null); },
  usefulEnough(m) {
    // test Session.get('nobot') last to get a fine-grained dependency
    // on the `nobot` session variable only for 'useless' messages
    const myNick = Meteor.userId();
    const botnick = botuser()._id;
    if (m.nick === myNick) { return true; }
    if (doesMentionNick(m)) { return true; }
    if (m.useful) { return true; }
    if ((m.tweet == null) && (m.nick !== botnick) && !m.useless_cmd) { return true; }
    return !HIDE_USELESS_BOT_MESSAGES.get();
  },
  presence_too_old() {
    if (!HIDE_OLD_PRESENCE.get()) { return false; }
    // If a message is too old, it will always be too old unless the option changes,
    // so don't re-evaluate the calculation every minute.
    const result = Tracker.nonreactive(() => {
      return this.message.timestamp < (Session.get('currentTime') - 3600000);
    });
    if (!result) {
      Session.get('currentTime');
    }
    return result;
  },
  messages() {
    if (!Template.instance().waitForObservers.get()) { return []; }
    const room_name = Session.get('room_name');
    // I will go out on a limb and say we need this because transform uses
    // doesMentionNick and transforms aren't usually reactive, so we need to
    // recompute them if you log in as someone else.
    Meteor.userId();
    return Messages.find({room_name, from_chat_subscription: true}, {
      sort: [['timestamp','asc']],
      transform: messageTransform
    }
    );
  }
});

let selfScroll = null;

const touchSelfScroll = function() {
  if (selfScroll != null) { Meteor.clearTimeout(selfScroll); }
  return selfScroll = Meteor.setTimeout(() => selfScroll = null
  , 1000); // ignore browser-generated scroll events for 1 (more) second
};

Template.messages.helpers({
  scrollHack(m) {
    touchSelfScroll(); // ignore scroll events caused by DOM update
    return maybeScrollMessagesView();
  }
});

const cleanupChat = function() {
  try {
    favicon.reset();
  } catch (error) {}
  instachat.mutationObserver?.disconnect();
  instachat.readObserver?.disconnect();
  return instachat.bottomObserver?.disconnect();
};

Template.messages.onDestroyed(function() {
  cleanupChat();
  return hideMessageAlert();
});

// window.unload is a bit spotty with async stuff, but we might as well try
$(window).unload(() => cleanupChat());

Template.messages.onCreated(function() {
  this.waitForObservers = new ReactiveVar(false);
  instachat.scrolledToBottom = true;
  this.autorun(() => {
    // put this in a separate autorun so it's not invalidated needlessly when
    // the limit changes.
    const room_name = Session.get('room_name');
    if (!room_name) { return; }
    return this.subscribe('register-presence', room_name, 'chat');
  });
    
  return this.autorun(() => {
    const invalidator = function() {
      instachat.ready = false;
      Session.set('chatReady', false);
      return hideMessageAlert();
    };
    invalidator();
    const room_name = Session.get('room_name');
    if (!room_name) { return; }
    // load messages for this page
    const onReady = () => {
      instachat.ready = true;
      Session.set('chatReady', true);
      if (this.limitRaise != null) {
        let firstMessage, offset;
        [[firstMessage, offset], this.limitRaise] = [this.limitRaise, undefined];
        return Tracker.afterFlush(() => {
          // only scroll if the button is visible, since it means we were at the
          // top and are still there. If we were anywhere else, the window would
          // have stayed put.
          const messages = this.$('#messages')[0];
          const chatStart = this.$('.bb-chat-load-more, .bb-chat-start')[0];
          if (chatStart.getBoundingClientRect().bottom <= messages.offsetTop) { return; }
          // We can't just scroll the last new thing into view because of the header.
          // we have to find the thing whose offset top is as much above the message
          // we want to keep in view as the offset top of the messages element.
          // We would have to loop to find firstMessage's index in messages.children,
          // so just iterate backwards. Shouldn't take too long to find ~100 pixels.
          let currMessage = firstMessage;
          while ((currMessage != null) && ((firstMessage.offsetTop - currMessage.offsetTop) < offset)) {
            currMessage = currMessage.previousElementSibling;
          }
          return currMessage?.scrollIntoView();
        });
      } else {
        return Tracker.afterFlush(() => {
          return this.$(`.bb-message[data-read=\"unread\"]:is(.bb-message-mention-me,[data-pm-to=\"${Meteor.userId}\"])`)[0]?.scrollIntoView();
        });
      }
    };
    this.subscribe('recent-messages', room_name, Session.get('limit'),
      {onReady});
    return Tracker.onInvalidate(invalidator);
  });
});

Template.messages.onRendered(function() {
  const chatBottom = document.getElementById('chat-bottom');
  instachat.bottomObserver = new IntersectionObserver(function(entries) {
    if (selfScroll != null) { return; }
    return instachat.scrolledToBottom = entries[0].isIntersecting;
  });
  instachat.bottomObserver.observe(chatBottom);
  if (FOLLOWUP_STYLE === "js") {
    // observe future changes
    this.$("#messages").each(function() {
      if (!Meteor.isProduction) { console.log(`Observing ${this}`); }
      return instachat.mutationObserver.observe(this, {childList: true});
    });
  }
  
  this.$("#messages").each(function() {
    return instachat.readObserver.observe(this, {attributes: true, attributeFilter: ['data-read'], subtree: true});
  });

  return Meteor.defer(() => this.waitForObservers.set(true));
});

Template.messages.events({
  'click .bb-chat-load-more'(event, template) {
    const firstMessage = event.currentTarget.nextElementSibling;
    const offset = firstMessage.offsetTop;
    template.limitRaise = [firstMessage, offset];
    return Session.set('limit', Session.get('limit') + CHAT_LIMIT_INCREMENT);
  }
});

const whos_here_helper = function() {
  const roomName = Session.get('room_name');
  return Presence.find({room_name: roomName, scope: 'chat'}, {sort: ['joined_timestamp']});
};

Template.embedded_chat.onCreated(function() {
  this.jitsi = new ReactiveVar(null);
  this.jitsiReady = new ReactiveVar(false);
  // Intentionally staying out of the meeting.
  this.jitsiLeft = new ReactiveVar(false);
  this.jitsiPinType = new ReactiveVar(null);
  this.jitsiPinId = new ReactiveVar(null);
  this.jitsiType = function() { return this.jitsiPinType.get() ?? Session.get('type'); };
  this.jitsiId = function() { return this.jitsiPinId.get() ?? Session.get('id'); };
  this.jitsiInOtherTab = function() {
    const jitsiTabUUID = reactiveLocalStorage.getItem('jitsiTabUUID');
    return (jitsiTabUUID != null) && (jitsiTabUUID !== CLIENT_UUID);
  };
  this.leaveJitsi = function() {
    this.jitsiLeft.set(true);
    this.jitsi.get()?.dispose();
    this.jitsi.set(null);
    this.jitsiPinType.set(null);
    this.jitsiPinId.set(null);
    this.jitsiRoom = null;
    return this.jitsiReady.set(false);
  };
  this.unsetCurrentJitsi = function() {
    if (CLIENT_UUID === reactiveLocalStorage.getItem('jitsiTabUUID')) {
      return reactiveLocalStorage.removeItem('jitsiTabUUID');
    }
  };
  return $(window).on('unload', this.unsetCurrentJitsi);
});

const jitsiRoomSubject = function(type, id) {

  if ('puzzles' === type) {
    return Puzzles.findOne(id).name ?? 'Puzzle';
  } else if ('0' === id) {
    return GENERAL_ROOM_NAME;
  } else {
    return 'Video Call';
  }
};

Template.embedded_chat.onRendered(function() {
  this.autorun(() => {
    if (this.jitsiLeft.get()) { return; }
    if (this.jitsiInOtherTab()) {
      this.leaveJitsi();
      return;
    }
    const newRoom = jitsiRoom(this.jitsiType(), this.jitsiId());
    let jitsi = this.jitsi.get();
    if ((jitsi != null) && (newRoom !== this.jitsiRoom)) {
      jitsi.dispose();
      jitsi = null;
      this.jitsi.set(null);
      this.jitsiRoom = null;
      this.jitsiReady.set(false);
    }
    if (newRoom != null) {
      if (jitsi == null) {
        jitsi = jitsiModule.createJitsiMeet(newRoom, this.find('#bb-jitsi-container'));
        if (jitsi == null) { return; }
        this.jitsiRoom = newRoom;
        this.jitsi.set(jitsi);
        jitsi.once('videoConferenceJoined', () => {
          if (this.jitsi.get() !== jitsi) { return; }
          return this.jitsiReady.set(true);
        });
        jitsi.once('videoConferenceLeft', () => {
          this.leaveJitsi();
          return reactiveLocalStorage.removeItem('jitsiTabUUID');
        });
        reactiveLocalStorage.setItem('jitsiTabUUID', CLIENT_UUID);
      }
      return this.subscribe('register-presence', `${this.jitsiType()}/${this.jitsiId()}`, 'jitsi');
    }
  });
  // If you reload the page the content of the user document won't be loaded yet.
  // The check that newroom is different from the current room means the display
  // name won't be set yet. This allows the display name and avatar to be set when
  // they become available. (It also updates them if they change.)
  this.autorun(() => {
    const user = Meteor.user();
    const jitsi = this.jitsi.get();
    if (jitsi == null) { return; }
    if (!this.jitsiReady.get()) { return; }
    return jitsi.executeCommands({
      displayName: nickAndName(user),
      avatarUrl: gravatarUrl({
        gravatar_md5: hashFromNickObject(user),
        size: 200
      })
    });
  });
  // The moderator should set the conference subject.
  return this.autorun(() => {
    const jitsi = this.jitsi.get();
    if (jitsi == null) { return; }
    if (!this.jitsiReady.get()) { return; }
    try {
      return jitsi.executeCommand('subject', jitsiRoomSubject(this.jitsiType(), this.jitsiId()));
    } catch (error) {}
  });
});

Template.embedded_chat.onDestroyed(function() {
  this.unsetCurrentJitsi();
  $(window).off('unload', this.unsetCurrentJitsi);
  return this.jitsi.get()?.dispose();
});

Template.embedded_chat.helpers({
  inJitsi() { return (Template.instance().jitsi.get() != null); },
  canJitsi() {
    return (jitsiRoom(Session.get('type'), Session.get('id')) != null) && Template.instance().jitsiLeft.get();
  },
  otherJitsi() { return Template.instance().jitsiInOtherTab(); },
  jitsiSize() {
    // Set up dependencies
    if (Template.instance().jitsi.get() == null) { return; }
    const sizeWouldBe = Math.floor((hsize() * 9) / 16);
    if (CAP_JITSI_HEIGHT.get()) {
      return Math.min(75, sizeWouldBe);
    }
    return sizeWouldBe;
  },
  jitsiPinSet() { return (Template.instance().jitsiPinType.get() != null); },
  jitsiUrl() { return jitsiUrl(Session.get('type'), Session.get('id')); },
  usingJitsiPin() {
    const instance = Template.instance();
    return jitsiRoom(instance.jitsiType(), instance.jitsiId()) !== jitsiRoom(Session.get('type'), Session.get('id'));
  },
  pinnedRoomName() {
    const instance = Template.instance();
    return jitsiRoomSubject(instance.jitsiType(), instance.jitsiId());
  },
  pinnedRoomUrl() {
    const instance = Template.instance();
    if (instance.jitsiType() === 'general') { return Meteor._relativeToSiteRootUrl('/'); }
    return Router.urlFor(instance.jitsiType(), instance.jitsiId());
  }
});

Template.embedded_chat.events({
  'click .bb-join-jitsi'(event, template) {
    reactiveLocalStorage.setItem('jitsiTabUUID', CLIENT_UUID);
    return template.jitsiLeft.set(false);
  },
  'click .bb-pop-jitsi'(event, template) {
    return template.leaveJitsi();
  },
  'click .bb-jitsi-pin'(event, template) {
    template.jitsiPinType.set(Session.get('type'));
    return template.jitsiPinId.set(Session.get('id'));
  },
  'click .bb-jitsi-unpin'(event, template) {
    template.jitsiPinType.set(null);
    return template.jitsiPinId.set(null);
  },
  'click .bb-jitsi-cap-height:not(.capped)'(event, template) {
    return CAP_JITSI_HEIGHT.set(true);
  },
  'click .bb-jitsi-cap-height.capped'(event, template) {
    return CAP_JITSI_HEIGHT.set(false);
  }
});

// Utility functions

const regex_escape = s => s.replace(/[$-\/?[-^{|}]/g, '\\$&');

const GLOBAL_MENTIONS = /@(channel|everyone)/i;

var doesMentionNick = function(doc, raw_nick=Meteor.userId()) {
  if (!raw_nick) { return false; }
  const nick = canonical(raw_nick);
  if (nick === doc.nick) { return false; } // messages from yourself don't count
  if (doc.to === nick) { return true; } // PMs to you count
  if (doc.mention?.includes(nick)) { return true; } // Mentions count
  if (doc.body == null) { return false; }
  if (doc.system) { return false; } // system messages don't count as mentions
  if (doc.bodyIsHtml) { return false; } // XXX we could fix this
  // These things are treated as mentions for everyone
  return GLOBAL_MENTIONS.test(doc.body);
};

const prettyRoomName = function() {
  const type = Session.get('type');
  const id = Session.get('id');
  const name = type === "general" ? GENERAL_ROOM : 
    Names.findOne(id)?.name;
  return (name || "unknown");
};

const joinRoom = function(type, id) {
  Router.goToChat(type, id);
  Tracker.afterFlush(() => scrollMessagesView());
  return $("#messageInput").select();
};

var maybeScrollMessagesView = (function() {
  let pending = false;
  return function() {
    if (!instachat.scrolledToBottom || !!pending) { return; }
    pending = true;
    return Tracker.afterFlush(function() {
      pending = false;
      return scrollMessagesView();
    });
  };
})();

var scrollMessagesView = function() {
  touchSelfScroll();
  instachat.scrolledToBottom = true;
  const last = document?.querySelector?.('#messages > *:last-child')?.scrollIntoView();
  // the scroll handler below will reset scrolledToBottom to be false
  return instachat.scrolledToBottom = true;
};

// ensure that we stay stuck to bottom even after images load
const imageScrollHack = (window.imageScrollHack = function(img) {
  touchSelfScroll(); // ignore scroll event generated by image resize
  if (img?.classList != null) {
    img.classList.remove('image-loading');
  }
  return maybeScrollMessagesView();
});
// note that image load does not delegate, so we can't use it here in
// a document-wide "live" event handler

Template.media_message.events({
  'mouseenter .bb-message-body .inline-image'(event, template) { return imageScrollHack(event.currentTarget); }});

Template.chat_format_body.helpers({
  chunks() {
    if (this.bodyIsHtml) {
      return chunk_html(this.body);
    } else {
      return chunk_text(this.body);
    }
  },
  chunk_template(type) {
    if (type === 'url') {
      return 'text_chunk_url_image';
    } else {
      return `text_chunk_${type}`;
    }
  }
});

Template.messages_input.helpers({
  show_presence() { return Template.instance().show_presence.get(); },
  whos_here: whos_here_helper,
  typeaheadResults() { return Template.instance().queryCursor.get(); },
  selected(id) { 
    return Template.instance().selected.get() === id;
  },
  error() { return Template.instance().error.get(); }
});

const MSG_PATTERN = /^\/m(sg)? ([A-Za-z_0-9]*)$/;
const MSG_AT_START_PATTERN = /^\/m(sg)? /;
const AT_MENTION_PATTERN = /(^|[\s])@([A-Za-z_0-9]*)$/;

Template.messages_input.onCreated(function() {
  this.autorun(() => {
    const room_name = Session.get('room_name');
    if (!room_name) { return; }
    return this.subscribe('presence-for-room', room_name);
  });

  this.show_presence = new ReactiveVar(false);
  this.query = new ReactiveVar(null);
  this.queryCursor = new ReactiveVar(null);
  this.selected = new ReactiveVar(null);
  this.error = new ReactiveVar(null);

  this.setQuery = function(query) {
    if (this.query.get() === query) { return; }
    this.query.set(query);
    if (query == null) {
      this.queryCursor.set(null);
      this.selected.set(null);
      return;
    }
    const qdoc = {$regex: query, $options: 'i'};
    const c = Meteor.users.find(
      {$or: [{_id: qdoc}, {real_name: qdoc}]}
    , {
      limit: 8,
      fields: { _id: 1
    },
      sort: {roles: -1, _id: 1}
    });
    this.queryCursor.set(c);
    const s = this.selected.get();
    const l = c.map(x => x._id); 
    if (l.includes(s)) { return; }
    return this.selected.set(l[0]);
  };

  this.moveActive = offset => {
    const s = this.selected.get();
    if (s == null) { return; }
    const c = this.queryCursor.get();
    if (c == null) { return; }
    const l = c.map(x => x._id);
    let i = offset + l.indexOf(s);
    if (i < 0) { i = l.length - 1; }
    if (i >= l.length) { i = 0; }
    return this.selected.set(l[i]);
  };

  this.autorun(() => {
    const c = this.queryCursor.get();
    if (!c) { return; }
    return c.observe({
      removedAt: (old, at) => {
        if (this.selected.get() === old._id) { return this.activateFirst(); }
      }
    });
  });

  this.activateFirst = function() {
    const c = this.queryCursor.get();
    if (!c) {
      this.selected.set(null);
      return;
    }
    const id = c.fetch()[0];
    return this.selected.set(id?._id);
  };

  this.updateTypeahead = function() {
    const i = this.$('#messageInput');
    const v = i.val();
    const ss = i.prop('selectionStart');
    const se = i.prop('selectionEnd');
    if (ss !== se) {
      this.setQuery(null);
      return;
    }
    const tv = v.substring(ss);
    const nextSpace = tv.search(/[\s]/);
    const consider = nextSpace === -1 ? v : v.substring(0, (ss + nextSpace));
    let match = consider.match(MSG_PATTERN);
    if (match) {
      return this.setQuery(match[2]);
    } else if (MSG_AT_START_PATTERN.test(v)) {
      // no mentions in private messages.
      this.setQuery(null);
      return;
    } else {
      match = consider.match(AT_MENTION_PATTERN);
      if (match) {
        return this.setQuery(match[2]);
      } else {
        this.setQuery(null);
        return;
      }
    }
  };

  this.confirmTypeahead = function(nick) {
    let newCaret;
    this.setQuery(null);
    const i = this.$('#messageInput');
    const v = i.val();
    const ss = i.prop('selectionStart');
    const tv = v.substring(ss);
    const nextSpace = tv.search(/[\s]/);
    const consider = nextSpace === -1 ? v : v.substring(0, (ss + nextSpace));
    let match = consider.match(MSG_PATTERN);
    if (match) {
      i.val(v.substring(0, match[0].length - match[2].length) + nick + ' ' + v.substring(consider.length));
      newCaret = (match[0].length - match[2].length) + nick.length + 1;
      i.focus();
      i[0].setSelectionRange(newCaret, newCaret);
      return;
    }
    match = consider.match(AT_MENTION_PATTERN);
    if (match) {
      i.val(v.substring(0, consider.length - match[2].length) + nick + ' ' + v.substring(consider.length));
      newCaret = (consider.length - match[2].length) + nick.length + 1;
      i.focus();
      return i[0].setSelectionRange(newCaret, newCaret);
    }
  };
    
  return this.submit = function(message) {
    let to;
    let n;
    if (!message) { return false; }
    const args = {
      room_name: Session.get('room_name'),
      body: message
    };
    let [word1, rest] = message.split(/\s+([^]*)/, 2);
    switch (word1) {
      case "/me":
        args.body = rest;
        args.action = true;
        break;
      case "/join":
        var result = Names.findOne({canon: canonical(rest.trim()), type: {$in: ['rounds', 'puzzles']}});
        if (((result == null)) && GENERAL_ROOM_REGEX.test(rest.trim())) {
          result = {type:'general', _id:'0'};
        }
        if ((error != null) || (result == null)) {
          this.error.set('unknown chat room');
          return false;
        }
        hideMessageAlert();
        joinRoom(result.type, result._id);
        return true;
        break;
      case "/msg": case "/m":
        // find who it's to
        [to, rest] = rest.split(/\s+([^]*)/, 2);
        var missingMessage = (!rest);
        while (rest) {
          let extra;
          n = Meteor.users.findOne(canonical(to));
          if (n) { break; }
          if (to === 'bot') { // allow 'bot' as a shorthand for 'codexbot'
            to = botuser()._id;
            continue;
          }
          [extra, rest] = rest.split(/\s+([^]*)/, 2);
          to += ' ' + extra;
        }
        if (n) {
          args.body = rest;
          args.to = to;
        } else {
          var error = missingMessage ?
            'tried to say nothing'
          :
            'Unknown recipient';
          this.error.set(error);
          return false;
        }
        break;
    }
    if (args.to == null) {
      // Can't mention someone in a private message
      const mentions = (() => {
        const result1 = [];
        for (let match of args.body.matchAll(/(^|[\s])@([a-zA-Z_0-9]*)([\s.?!,]|$)/g)) {
          const canon = canonical(match[2]);
          if (Meteor.users.findOne(canon) == null) { continue; }
          result1.push(canon);
        }
        return result1;
      })();
      if (mentions.length) { args.mention = mentions; }
    }
    Meteor.call('newMessage', args); // updates LastRead as a side-effect
    // for flicker prevention, we are currently not doing latency-compensation
    // on the newMessage call, which makes the below ineffective.  But leave
    // it here in case we turn latency compensation back on.
    Tracker.afterFlush(() => scrollMessagesView());
    this.history_ts = null;
    return true;
  };
});

const format_body = function(msg) {
  if (msg.action) {
    return `/me ${msg.body}`;
  }
  if (msg.to != null) {
    return `/msg ${msg.to} ${msg.body}`;
  }
  return msg.body;
};

Template.messages_input.events({
  'click .bb-show-whos-here'(event, template) {
    const rvar = template.show_presence;
    return rvar.set(!rvar.get());
  },
  "keydown textarea"(event, template) {
    let msg, query, s;
    template.error.set(null);
    if (['Up', 'ArrowUp'].includes(event.key)) { 
      if (template.query.get() != null) {
        event.preventDefault();
        template.moveActive(-1);
      } else if (event.target.selectionEnd === 0) {
        // Checking that the cursor is at the start of the box.
        query = {
          room_name: Session.get('room_name'),
          nick: Meteor.userId(),
          system: { $ne: true
        },
          bodyIsHtml: { $ne: true
        },
          from_chat_subscription: true,
          on_behalf: { $ne: true
        }
        };
        if (template.history_ts != null) {
          query.timestamp = {$lt: template.history_ts};
        }
        msg = Messages.findOne(query,
          {sort: {timestamp: -1}});
        if (msg != null) {
          template.history_ts = msg.timestamp;
          event.target.value = format_body(msg);
          event.target.setSelectionRange(0, 0);
        }
        return;
      }
    }
    if (['Down', 'ArrowDown'].includes(event.key)) {
      if (template.query.get() != null) {
        event.preventDefault();
        template.moveActive(1);
      } else if (event.target.selectionStart === event.target.value.length) {
        // 40 is arrow down. Checking that the cursor is at the end of the box.
        if (template.history_ts == null) { return; }
        // Pushing down only means anything if you're in history.
        query = {
          room_name: Session.get('room_name'),
          nick: Meteor.userId(),
          system: { $ne: true
        },
          bodyIsHtml: { $ne: true
        },
          timestamp: { $gt: template.history_ts
        },
          from_chat_subscription: true,
          on_behalf: { $ne: true
        }
        };
        msg = Messages.findOne(query,
          {sort: {timestamp: 1}});
        if (msg != null) {
          template.history_ts = msg.timestamp;
          const body = format_body(msg);
          event.target.value = body;
          event.target.setSelectionRange(body.length, body.length);
        } else {
          event.target.value = '';
          template.history_ts = null;
        }
        return;
      }
    }

    if ((event.which === 13) && !(event.shiftKey || event.ctrlKey)) {
      event.preventDefault(); // prevent insertion of enter
      s = template.selected.get();
      if (s != null) {
        // Autocomplete if relevant.
        template.confirmTypeahead(s);
      } else {
        // implicit submit on enter (but not shift-enter or ctrl-enter)
        const $message = $(event.currentTarget);
        const message = $message.val();
        if (template.submit(message)) {
          $message.val("");
        }
      }
    }

    // Tab also autocompletes
    if (event.key === 'Tab') {
      s = template.selected.get();
      if (s != null) {
        event.preventDefault();
        return template.confirmTypeahead(s);
      }
    }
  },

  'blur #messageInput'(event, template) {
    // alert for unread messages
    return instachat.alertWhenUnreadMessages = true;
  },
  'focus #messageInput'(event, template) { 
    if (instachat.ready) { updateLastRead(); } // skip during initial load
    instachat.alertWhenUnreadMessages = false;
    return hideMessageAlert();
  },
  'keyup/click/touchend/mouseup #messageInput'(event, template) {
    return template.updateTypeahead();
  },
  'click #messageInputTypeahead a[data-value]'(event, template) {
    event.preventDefault();
    return template.confirmTypeahead(event.currentTarget.dataset.value);
  },
  'mouseenter #messageInputTypeahead'(event, template) {
    return template.selected.set(null);
  },
  'mouseleave #messageInputTypeahead'(event, template) {
    return template.activateFirst();
  }
});

var updateLastRead = function() {
  const lastMessage = Messages.findOne({
    room_name: Session.get('room_name'),
    from_chat_subscription: true
  }
  ,
    {sort: [['timestamp','desc']]});
  if (!lastMessage) { return; }
  return Meteor.call('updateLastRead', {
    room_name: Session.get('room_name'),
    timestamp: lastMessage.timestamp
  }
  );
};

var hideMessageAlert = () => updateNotice(0, 0);

Template.chat.onCreated(function() {
  this.autorun(() => $("title").text("Chat: "+prettyRoomName()));
  return this.autorun(function() {
    if (isVisible() && instachat.ready) { return updateLastRead(); }
  });
});

Template.chat.onRendered(function() {
  $(window).resize();
  const type = Session.get('type');
  const id = Session.get('id');
  return joinRoom(type, id);
});

// App startup
Meteor.startup(function() {
  if (typeof Audio !== 'function') { return; } // for phantomjs
  return instachat.messageMentionSound = new Audio(Meteor._relativeToSiteRootUrl('/sound/Electro_-S_Bainbr-7955.wav'));
});

var updateNotice = _.debounce(((function() {
  let [lastUnread, lastMention] = [0, 0];
  return function(unread, mention) {
    if ((mention > lastMention) && instachat.ready) {
      if (!MUTE_SOUND_EFFECTS.get()) {
        instachat.messageMentionSound?.play?.()?.catch?.(err => console.error(err.message, err));
      }
    }
    // update title and favicon
    if (mention > 0) {
      if (mention !== lastMention) { favicon.badge(mention, {bgColor: '#00f'}); }
    } else {
      if (unread !== lastUnread) { favicon.badge(unread, {bgColor: '#000'}); }
    }
    //# XXX check instachat.ready and instachat.alertWhenUnreadMessages ?
    return [lastUnread, lastMention] = [unread, mention];
  };
}
)()), 100);

Template.messages.onCreated(function() { return this.autorun(function() {
  const nick = Meteor.userId() || '';
  const room_name = Session.get('room_name');
  if (!nick || !room_name) {
    Session.set('lastread', undefined);
    return hideMessageAlert();
  }
  Tracker.onInvalidate(hideMessageAlert);
  // watch the last read and update the session
  const lastread = LastRead.findOne(room_name);
  if (!lastread) {
    Session.set('lastread', undefined);
    return hideMessageAlert();
  }
  Session.set('lastread', lastread.timestamp);
  // watch the unread messages
  let total_unread = 0;
  let total_mentions = 0;
  let update = () => false; // ignore initial updates
  Messages.find({
    room_name,
    nick: { $ne: nick
  },
    timestamp: { $gt: lastread.timestamp
  },
    from_chat_subscription: true}).observe({
    added(item) {
      if (item.system) { return; }
      total_unread++;
      if (doesMentionNick(item)) { total_mentions++; }
      return update();
    },
    removed(item) {
      if (item.system) { return; }
      total_unread--;
      if (doesMentionNick(item)) { total_mentions--; }
      return update();
    },
    changed(newItem, oldItem) {
      if (!oldItem.system) {
        total_unread--;
        if (doesMentionNick(oldItem)) { total_mentions--; }
      }
      if (!newItem.system) {
        total_unread++;
        if (doesMentionNick(newItem)) { total_mentions++; }
      }
      return update();
    }
  });
  // after initial query is processed, handle updates
  update = () => updateNotice(total_unread, total_mentions);
  return update();
});
 });

// evil hack to workaround scroll issues.
(function() {
  const f = function() {
    if (!Session.equals('currentPage', 'chat')) { return; }
    return maybeScrollMessagesView();
  };
  return Meteor.setTimeout(f, 5000);
})();
