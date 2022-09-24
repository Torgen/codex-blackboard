// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '/lib/imports/canonical.js';
import { LastRead, Messages, Puzzles, Roles, Rounds } from '/lib/imports/collections.js';
import md5 from 'md5';
import Router from '/client/imports/router.js';
import { jitsiUrl } from './imports/jitsi.js';
import { hashFromNickObject, nickAndName } from './imports/nickEmail.js';
import botuser from './imports/botuser.js';
import keyword_or_positional from './imports/keyword_or_positional.js';
import loginWithCodex from '/client/imports/accounts.js';
import { BB_DISABLE_RINGHUNTERS_HEADER, GENERAL_ROOM_NAME } from '/client/imports/server_settings.js';
import './imports/timestamp.js';

// templates, event handlers, and subscriptions for the site-wide
// header bar, including the login modals and general Spacebars helpers

(function() {
  const clickHandler = function(event, template) {
    if (event.button !== 0) { return; } // check right-click
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) { return; } // check alt/ctrl/shift/command clicks
    const target = event.currentTarget;
    // href on the element directly is absolute. We want the relative path if it exists for routing.
    const rawHref = target.getAttribute('href');
    if (/^https?:/.test(rawHref)) { return; }
    event.preventDefault();
    if (target.classList.contains('bb-pop-out')) {
      // here we want the absolute path since it's for a new window.
      return window.open(target.href, 'Pop out', 
        ("height=480,width=480,menubar=no,toolbar=no,personalbar=no,"+
        "status=yes,resizeable=yes,scrollbars=yes")
      );
    } else {
      return Router.navigate(rawHref, {trigger:true});
    }
  };
  return Template.page.events({
    'click a.puzzles-link': clickHandler,
    'click a.rounds-link': clickHandler,
    'click a.chat-link': clickHandler,
    'click a.graph-link': clickHandler,
    'click a.home-link': clickHandler,
    'click a.oplogs-link': clickHandler,
    'click a.callins-link': clickHandler,
    'click a.logistics-link': clickHandler,
    'click a.facts-link': clickHandler
  });
})();

Template.registerHelper('drive_link', function(args) {
  args = keyword_or_positional('id', args);
  return `https://docs.google.com/folder/d/${args.id}/edit`;
});
Template.registerHelper('spread_link', function(args) {
  args = keyword_or_positional('id', args);
  return `https://docs.google.com/spreadsheets/d/${args.id}/edit`;
});
Template.registerHelper('doc_link', function(args) {
  args = keyword_or_positional('id', args);
  return `https://docs.google.com/document/d/${args.id}/edit`;
});

// nicks
Template.registerHelper('nickOrName', function(args) {
  const {
    nick
  } = keyword_or_positional('nick', args);
  const n = Meteor.users.findOne(canonical(nick));
  return n?.real_name || n?.nickname || nick;
});
Template.registerHelper('nickAndName', function(args) {
  const {
    nick
  } = keyword_or_positional('nick', args);
  const n = Meteor.users.findOne(canonical(nick ?? {nickname: nick}));
  return nickAndName(n);
});
Template.registerHelper('nickExists', nick => Meteor.users.findOne({_id: nick}) != null);
Template.registerHelper('onduty', nick => Roles.findOne('onduty')?.holder === nick);

const privateMessageTransform = msg => ({
  _id: msg._id,
  message: msg,

  read() {
    return (msg.timestamp <= LastRead.findOne('private')?.timestamp) || (msg.timestamp <= LastRead.findOne(msg.room_name)?.timestamp);
  },

  showRoom: true
});

Template.header_loginmute.onCreated(function() {
  return this.visibleTab = new ReactiveVar('private');
});

//############# log in/protect/mute panel ####################
Template.header_loginmute.helpers({
  sessionNick() { // TODO(torgen): replace with currentUser
    const user = Meteor.user();
    if (user == null) { return; }
    return {
      name: user.nickname,
      canon: user._id,
      realname: user.real_name || user.nickname,
      gravatar_md5: hashFromNickObject(user)
    };
  },
  unreadPrivateMessages() {
    const count = Messages.find({
      to: Meteor.userId(),
      timestamp: { $gt: LastRead.findOne('private')?.timestamp ?? 0
    }}).fetch().filter(msg => msg.timestamp > (LastRead.findOne(msg.room_name)?.timestamp ?? 0)).length;
    if (count !== 0) { return count; }
  },
  unreadMentions() {
    const count = Messages.find({
      mention: Meteor.userId(),
      timestamp: { $gt: LastRead.findOne('private')?.timestamp ?? 0
    }}).fetch().filter(msg => msg.timestamp > (LastRead.findOne(msg.room_name)?.timestamp ?? 0)).length;
    if (count !== 0) { return count; }
  },
  clamp(value, limit) {
    if (!value) { return; }
    if (value > limit) { return `${limit}+`; }
    return value;
  },
  privateMessages() {
    return Messages.find(
      {to: Meteor.userId()}
    , {
      sort: { timestamp: -1
    },
      transform: privateMessageTransform
    }
    );
  },
  mentions() {
    return Messages.find(
      {mention: Meteor.userId()}
    , {
      sort: { timestamp: -1
    },
      transform: privateMessageTransform
    }
    );
  },
  isVisible(tabname) {
    return Template.instance().visibleTab.get() === tabname;
  }
});

var clickOutsideAvatarDropdownHandler = function(event) {
  if (event.target.closest('#bb-avatar-dropdown')) { return; }
  $('#bb-avatar-dropdown').removeClass('open');
  return $('body').off('click', clickOutsideAvatarDropdownHandler);
};

Template.header_loginmute.events({
  "click .bb-logout"(event, template) {
    event.preventDefault();
    return Meteor.logout();
  },
  "click .bb-unprotect"(event, template) {
    return Router.navigate("/edit", {trigger: true});
  },
  "click .bb-protect"(event, template) {
    return Router.navigate("/", {trigger: true});
  },
  'click li[data-tab]:not(.active)'(event, template) {
    return template.visibleTab.set(event.currentTarget.dataset.tab);
  },
  'click #bb-mark-private-read'(event, template) {
    event.preventDefault();
    const latest = Messages.findOne({$or: [{to: Meteor.userId()}, {mention: Meteor.userId()}]}, {sort: {timestamp: -1}}).timestamp;
    return Meteor.call('updateLastRead', {
      room_name: 'private',
      timestamp: latest
    }
    );
  },
  'click #bb-avatar-dropdown > .dropdown-toggle'(event, template) {
    const dropdown = template.$('#bb-avatar-dropdown');
    const open = dropdown.hasClass('open');
    dropdown.toggleClass('open');
    if (open) {
      return $('body').off('click', clickOutsideAvatarDropdownHandler);
    } else {
      return $('body').on('click', clickOutsideAvatarDropdownHandler);
    }
  }
});

Template.connection_button.helpers({
  connectStatus: Meteor.status});

Template.connection_button.events({
  "click .connected, click .connecting, click .waiting"(event, template) {
    return Meteor.disconnect();
  },
  "click .failed, click .offline"(event, template) {
    return Meteor.reconnect();
  }
});

//############# breadcrumbs #######################

const crumbs_equal = function(x, y) {
  if (x.length !== y.length) { return false; }
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = y[i];
    if (xi.type !== yi.type) { return false; }
    if (xi.page !== yi.page) { return false; }
    if (xi.id === yi.id) { continue; }
    if ('object' !== typeof xi.id) { return false; }
    if ('object' !== typeof yi.id) { return false; }
    if (Object.keys(xi.id).length !== Object.keys(yi.id).length) { return false; }
    for (let k in xi.id) {
      const v = xi.id[k];
      if (yi.id[k] == null) { return false; }
      if (yi.id[k] !== v) { return false; }
    }
  }
  return true;
};

const breadcrumbs_var = new ReactiveVar([{page: 'blackboard', type: 'general', id: '0'}], crumbs_equal);

const in_crumbs = function(crumbs, type, id) {
  if (crumbs == null) { return false; }
  for (let crumb of crumbs) {
    if (crumb.type !== type) { continue; }
    if (crumb.page === 'metas') {
      if (crumb.id[id] != null) { return true; }
    } else {
      if (crumb.id === id) { return true; }
    }
  }
  return false;
};

// One autorun to determine if the current page should be the leaf.
// Basically, if the current page isn't in the current breadcrumb trail,
// it should be the leaf.
Tracker.autorun(function() {
  const breadcrumbs = breadcrumbs_var.get();
  const type = Session.get('type');
  const id = Session.get('id');
  if (!in_crumbs(breadcrumbs, type, id)) {
    return Session.set({
      breadcrumbs_leaf_type: type,
      breadcrumbs_leaf_id: id
    });
  }
});

// Because our graph is unweighted, BFS suffices--we don't need something fancy
// like Dijkstra.
const min_meta_paths = function(root) {
  let depth = 0;
  let current = [root];
  let next = {};
  const depths = {};
  const trail = [];
  depths[root] = -1;
  while (true) {
    for (let id of current) {
      const puzzle = Puzzles.findOne(id);
      if (puzzle == null) { continue; }
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
};

const generate_crumbs = function(leaf_type, leaf_id) {
  const crumbs = [{page: 'blackboard', type: 'general', id: '0'}];
  leaf_type = Session.get('breadcrumbs_leaf_type');
  leaf_id = Session.get('breadcrumbs_leaf_id');
  if ((leaf_type == null) || (leaf_id == null)) { return crumbs; }
  if (leaf_type === 'puzzles') {
    const metas = min_meta_paths(leaf_id);
    // Deepest are last here, so...
    metas.reverse();
    // One breadcrumb for each level of meta.
    // Consider grouping together beyond some number of levels
    for (let meta of metas) {
      crumbs.push({page: 'metas', type: 'puzzles', id: meta});
    }
    crumbs.push({page: 'puzzle', type: 'puzzles', id: leaf_id});
  } else if (leaf_type === 'rounds') {
    crumbs.push({page: 'round', type: 'rounds', id: leaf_id});
  } else {
    if (leaf_type !== 'general') {
      crumbs.push({page: leaf_type, type: leaf_type, id: leaf_id});
    }
  }
  return crumbs;
};

// A second autorun to determine what should be in the crumbs. 
// Basically, if the current type/id is the leaf, always regenerate the crumbs
// from the breadcrumb leaf.
// Otherwise generate them only if the current type/id appears in the new trail.
// This stops the current crumb from vanishing if you're viewing a meta above a
// puzzle when the puzzle is removed from the meta.
Tracker.autorun(function() {
  const leaf_type = Session.get('breadcrumbs_leaf_type');
  const leaf_id = Session.get('breadcrumbs_leaf_id');
  const crumbs = generate_crumbs(leaf_type, leaf_id);
  const type = Session.get('type');
  const id = Session.get('id');
  if ((type !== leaf_type) || (id !== leaf_id)) {
    if (!in_crumbs(crumbs, type, id)) { return; }
  }
  return breadcrumbs_var.set(crumbs);
});

Template.header_breadcrumb_chat.helpers({
  inThisRoom() {
    if (!Session.equals('currentPage', 'chat')) { return false; }
    if (!Session.equals('type', this.type)) { return false; }
    return Session.equals('id', this.id);
  }
});

const active = function() {
  return Session.equals('type', this.type) && Session.equals('id', this.id);
};

Template.header_breadcrumb_blackboard.helpers({
  active});

Template.header_breadcrumb_extra_links.helpers({
  active() { return active.call(Template.parentData(1)); },
  jitsiUrl() { return jitsiUrl(Template.parentData(1).type, Template.parentData(1).id); }
});

Template.header_breadcrumb_round.helpers({
  round() { if (this.id) { return Rounds.findOne(this.id); } },
  active
});

Template.header_breadcrumb_metas.helpers({
  active_meta() {
    if (!Session.equals('type', this.type)) { return; }
    const id = Session.get('id');
    if (this.id[id] != null) {
      return id;
    }
  },
  inactive_metas() {
    let keys = Object.keys(this.id);
    if (Session.equals('type', this.type)) {
      const id = Session.get('id');
      keys = keys.filter(x => x !== id);
    }
    if (keys.length === 1) {
      return {
        one: keys[0],
        all: keys
      };
    } else if (keys.length === 0) {
      return {};
    } else {
      return {all: keys};
    }
  }
});

Template.header_breadcrumb_one_meta.helpers({
  puzzle() { if (this.id) { return Puzzles.findOne(this.id); } },
  active
});

Template.header_breadcrumb_puzzle.helpers({
  puzzle() { if (this.id) { return Puzzles.findOne(this.id); } },
  active
});

Template.header_breadcrumbs.onCreated(function() {
  return this.autorun(() => Meteor.call('getRinghuntersFolder', function(error, f) {
    if (error == null) {
      return Session.set('RINGHUNTERS_FOLDER', (f || undefined));
    }
  }));
});

Template.header_breadcrumbs.helpers({
  breadcrumbs() { return breadcrumbs_var.get(); },
  crumb_template() { return `header_breadcrumb_${this.page}`; }
});

Template.header_breadcrumbs.onRendered(function() {
  // tool tips
  return $(this.findAll('a.bb-drive-link[title]')).tooltip({placement: 'bottom'});
});

//############# nick selection ####################

Template.header_nickmodal_contents.onCreated(function() {
  this.suppressRender = new ReactiveVar(Meteor.loggingIn());
  this.autorun(() => {
    if (!Meteor.loggingIn()) { return this.suppressRender.set(false); }
  });
  this.gravatarHash = new ReactiveVar(md5(''));
  // we'd need to subscribe to 'all-nicks' here if we didn't have a permanent
  // subscription to it (in main.coffee)
  this.typeaheadSource = (query,process) => {
    this.update(query);
    return (Meteor.users.find({bot_wakeup: {$exists: false}}).fetch().map((n) => n.nickname));
  };
  this.update = (query, options) => {
    // can we find an existing nick matching this?
    const n = query ? Meteor.users.findOne(canonical(query)) : undefined;
    if (n || options?.force) {
      const realname = n?.real_name;
      $('#nickRealname').val(realname || '');
      $('#nickEmail').val('');
    }
    return this.updateGravatar(n);
  };
  return this.updateGravatar = q => {
    if ($('#nickEmail').val()) {
      this.gravatarHash.set(md5($('#nickEmail').val()));
      return;
    }
    const nick = $('#nickInput').val() ?? '';
    if (q == null) {
      q = {_id: canonical(nick)};
    }
    return this.gravatarHash.set(hashFromNickObject(q));
  };
});
const nickInput = new Tracker.Dependency;
Template.header_nickmodal_contents.helpers({
  suppressRender() { return Template.instance().suppressRender.get(); },
  disabled() {
    nickInput.depend();
    return Meteor.loggingIn() || !$('#nickInput').val();
  },
  hash() { return Template.instance().gravatarHash.get(); }
});
Template.header_nickmodal_contents.onRendered(function() {
  $('#nickSuccess').val('false');
  $('#nickPickModal').modal({keyboard: false, backdrop:"static"});
  $('#nickInput').select();
  const firstNick = Meteor.userId() || '';
  $('#nickInput').val(firstNick);
  this.update(firstNick, {force:true});
  return $('#nickInput').typeahead({
    source: this.typeaheadSource,
    updater: item => {
      this.update(item);
      return item;
    }
  });
});
Template.header_nickmodal_contents.events({
  "click .bb-submit"(event, template) {
    return $('#nickPick').submit();
  },
  'input #nickInput'(event, template) {
    return nickInput.changed();
  },
  "keydown #nickInput"(event, template) {
    // implicit submit on <enter> if typeahead isn't shown
    if ((event.which === 13) && !$('#nickInput').data('typeahead').shown) {
      return $('#nickPick').submit();
    }
  },
  "keydown #nickRealname"(event, template) {
    if (event.which === 13) { return $('#nickEmail').select(); }
  },
  "keydown #nickEmail"(event, template) {
    if (event.which === 13) { return $('#nickPick').submit(); }
  },
  "input #nickEmail": _.debounce(((event, template) => template.updateGravatar()), 500),
  'submit #nickPick'(event, template) {
    const nick = $("#nickInput").val().replace(/^\s+|\s+$/g,""); //trim
    if (!nick) { return false; }
    loginWithCodex(nick, $('#nickRealname').val(), $('#nickEmail').val(), $('#passwordInput').val(), function(err, res) {
      if (err != null) {
        const le = $("#loginError");
        if (err.reason != null) {
          le.text(err.reason);
        }
        if (err.details?.field != null) {
          template.$('[data-argument]').removeClass('error');
          return template.$(`[data-argument=\"${err.details.field}\"]`).addClass('error');
        }
      }
    });
    return false;
  }
});

const RECENT_GENERAL_LIMIT = 2;

//############# operation/chat log in header ####################
Template.header_lastchats.helpers({
  lastchats() {
    const options = [{room_name: 'oplog/0'}, {to: Meteor.userId()}];
    if (!Session.equals('room_name', 'general/0')) {
      options.push({room_name: 'general/0'});
    }
    return Messages.find({
      $or: options, system: {$ne: true}, bodyIsHtml: {$ne: true}, header_ignore: {$ne: true}
    }, {sort: [["timestamp","desc"]], limit: RECENT_GENERAL_LIMIT});
  },
  msgbody() {
    if (this.bodyIsHtml) { return new Spacebars.SafeString(this.body); } else { return this.body; }
  },
  roomname() {
    if (Session.equals('room_name', 'general/0')) {
      return 'Updates';
    } else {
      return GENERAL_ROOM_NAME;
    }
  },
  roomicon() {
    let query;
    return query = Session.equals('room_name', 'general/0') ?
      'newspaper'
    :
      'comments';
  },
  puzzle_id() { return this.room_name.match(/puzzles\/(.*)/)[1]; },
  icon_label() {
    if (this.type === 'roles') {
      return ['pager', (this.id != null) ? 'success' : 'important'];
    } else if (/Added/.test(this.body)) {
      if (this.type === 'puzzles') {
        return ['puzzle-piece', 'success'];
      } else if (this.type === 'rounds') {
        return ['globe', 'success'];
      } else {
        return ['plus'];
      }
    } else if (/Deleted answer/.test(this.body)) {
      return ['sad-tear', 'important'];
    } else if (/Deleted/.test(this.body)) {
      return ['trash-alt', 'info'];
    } else if (/Renamed/.test(this.body)) {
      return ['id-badge', 'info'];
    } else if (/New.*submitted for/.test(this.body)) {
      return ['phone', 'success'];
    } else if (/Canceled call-in/.test(this.body)) {
      return ['phone-slash', 'important'];
    } else if (/Help requested/.test(this.body)) {
      return ['ambulance', 'warning'];
    } else if (/Help request cancelled/.test(this.body)) {
      return ['lightbulb', 'success'];
    } else if (/Found an answer/.test(this.body)) {
      return ['trophy', 'success'];
    } else if (/reports incorrect answer/.test(this.body)) {
      return ['heart-broken', 'important'];
    } else {
      return ['exclamation-circle'];
    }
  }});

// subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastchats.onCreated(function() {
  if (BB_DISABLE_RINGHUNTERS_HEADER) { return; }
  return this.autorun(() => {
    this.subscribe('recent-messages', 'oplog/0', 2);
    return this.subscribe('recent-header-messages');
  });
});
