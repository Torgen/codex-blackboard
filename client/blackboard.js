/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '/lib/imports/canonical.coffee';
import { getTag, isStuck } from '/lib/imports/tags.coffee';
import { LastAnswer, Presence, Puzzles, Rounds } from '/lib/imports/collections.coffee';
import { confirm } from '/client/imports/modal.coffee';
import { findByChannel } from '/client/imports/presence_index.coffee';
import { jitsiUrl } from './imports/jitsi.coffee';
import puzzleColor  from './imports/objectColor.coffee';
import { HIDE_SOLVED, HIDE_SOLVED_FAVES, HIDE_SOLVED_METAS, MUTE_SOUND_EFFECTS, SORT_REVERSE, VISIBLE_COLUMNS } from './imports/settings.coffee';
import { TEAM_NAME, WHOSE_GITHUB } from '/client/imports/server_settings.coffee';
import * as notification from '/client/imports/notification.coffee';
import { reactiveLocalStorage } from './imports/storage.coffee';
import PuzzleDrag from './imports/puzzle_drag.coffee';
import okCancelEvents from './imports/ok_cancel_events.coffee';
import '/client/imports/ui/components/create_object/create_object.coffee';
import '/client/imports/ui/components/edit_field/edit_field.coffee';
import '/client/imports/ui/components/edit_tag_value/edit_tag_value.coffee';
import '/client/imports/ui/components/edit_object_title/edit_object_title.coffee';
import '/client/imports/ui/components/fix_puzzle_drive/fix_puzzle_drive.coffee';
import '/client/imports/ui/components/onduty/control.coffee';
import '/client/imports/ui/components/tag_table_rows/tag_table_rows.coffee';

const SOUND_THRESHOLD_MS = 30*1000; // 30 seconds

const blackboard = {}; // store page global state

Meteor.startup(function() {
  if (typeof Audio === 'function') { // for phantomjs
    blackboard.newAnswerSound = new Audio(Meteor._relativeToSiteRootUrl('/sound/that_was_easy.wav'));
  }
  if (blackboard.newAnswerSound?.play == null) { return; }
  // set up a persistent query so we can play the sound whenever we get a new
  // answer
  // note that this observe 'leaks' -- we're not setting it up/tearing it
  // down with the blackboard page, we're going to play the sound whatever
  // page the user is currently on.  This is "fun".  Trust us...
  Meteor.subscribe('last-answered-puzzle');
  // ignore added; that's just the startup state.  Watch 'changed'
  return LastAnswer.find({}).observe({
    async changed(doc, oldDoc) {
      if (doc.target == null) { return; } // 'no recent puzzle was solved'
      if (doc.target === oldDoc.target) { return; } // answer changed, not really new
      console.log('that was easy', doc, oldDoc);
      if (MUTE_SOUND_EFFECTS.get()) { return; }
      try {
        return await blackboard.newAnswerSound.play();
      } catch (err) {
        return console.error(err.message, err);
      }
    }
  });
});

Meteor.startup(function() {
  // see if we've got native emoji support, and add the 'has-emojis' class
  // if so; inspired by
  // https://stackoverflow.com/questions/27688046/css-reference-to-phones-emoji-font
  const checkEmoji = function(char, x, y, fillStyle='#000') {
    const node = document.createElement('canvas');
    const ctx = node.getContext('2d');
    ctx.fillStyle = fillStyle;
    ctx.textBaseline = 'top';
    ctx.font = '32px Arial';
    ctx.fillText(char, 0, 0);
    return ctx.getImageData(x, y, 1, 1);
  };
  const reddot = checkEmoji('\uD83D\uDD34', 16, 16);
  const dancing = checkEmoji('\uD83D\uDD7A', 12, 16); // unicode 9.0
  if ((reddot.data[0] > reddot.data[1]) && ((dancing.data[0] + dancing.data[1] + dancing.data[2]) > 0)) {
    console.log('has unicode 9 color emojis');
    return document.body.classList.add('has-emojis');
  }
});

//######## general properties of the blackboard page ###########

const setCompare = function(was, will) {
  if ((was == null) && (will == null)) { return true; }
  if ((was == null) || (will == null)) { return false; }
  return (was.size === will.size) && [...was].every(v => will.has(v));
};

Template.blackboard.onCreated(function() {
  this.typeahead = function(query,process) {
    const result = new Set;
    for (let n of Meteor.users.find({bot_wakeup: {$exists: false}})) {
      result.add(n.nickname);
      if (n.real_name != null) { result.add(n.real_name); }
    }
    return [...result];
  };
  this.addRound = new ReactiveVar(false);
  this.userSearch = new ReactiveVar(null);
  this.foundAccounts = new ReactiveVar(null, setCompare);
  this.foundPuzzles = new ReactiveVar(null, setCompare);
  this.autorun(() => {
    const userSearch = this.userSearch.get();
    if ((userSearch == null)) {
      this.foundAccounts.set(null);
      return;
    }
    const c = Meteor.users.find({
      $or: [
        { nickname: { $regex: `.*${userSearch}.*`}},
        { real_name: { $regex: `.*${userSearch}.*`}},
      ]
    }
    , {fields: { _id: 1 }});
    return this.foundAccounts.set(new Set(c.map(v => v._id)));
  });
  this.autorun(() => {
    const foundAccounts = this.foundAccounts.get();
    if ((foundAccounts == null)) {
      this.foundPuzzles.set(null);
      return;
    }
    const p = Presence.find({
      nick: { $in: [...foundAccounts]
    },
      scope: { $in: ['chat', 'jitsi']
    }});
    const res = new Set;
    p.forEach(function(pres) {
      const match = pres.room_name.match(/puzzles\/(.*)/);
      if (match == null) { return; }
      return res.add(match[1]);});
    return this.foundPuzzles.set(res);
  });
  return this.autorun(() => {
    return this.subscribe('solved-puzzle-time');
  });
});

Template.blackboard.onRendered(function() {
  return $('input.bb-filter-by-user').typeahead({
    source: this.typeahead,
    updater: item => {
      this.userSearch.set(item);
      return item;
    }
  });
});

Template.blackboard.helpers({
  whoseGitHub() { return WHOSE_GITHUB; },
  filter() { return (Template.instance().userSearch.get() != null); },
  searchResults() {
    return (Template.instance().foundPuzzles.get() ?? []).map((id) => Puzzles.findOne({_id: id}));
  }});

Template.blackboard.events({
  'click .puzzle-working .button-group:not(.open) .bb-show-filter-by-user'(event, template) {
    return Meteor.defer(() => template.find('.bb-filter-by-user').focus());
  },
  'click .puzzle-working .dropdown-menu'(event, template) {
    return event.stopPropagation();
  },
  'keyup .bb-filter-by-user'(event, template) {
    if (event.keyCode !== 13) { return; }
    return template.userSearch.set((event.target.value || null));
  },
  'click .bb-clear-filter-by-user'(event, template) {
    return template.userSearch.set(null);
  }
});

// Notifications

Template.blackboard.helpers({
  notificationStreams: notification.streams,
  notificationsAsk: notification.shouldAsk,
  notificationsEnabled() { return notification.granted(); },
  anyNotificationsEnabled() { return (notification.count() > 0); },
  notificationStreamEnabled(stream) { return notification.get(stream); }
});
Template.blackboard.events({
  "click .bb-notification-ask"(event, template) {
    return notification.ask();
  },
  "click .bb-notification-enabled"(event, template) {
    if (notification.count() > 0) {
      return (() => {
        const result = [];
        for (let item of notification.streams) {
          result.push(notification.set(item.name, false));
        }
        return result;
      })();
    } else {
      return (() => {
        const result1 = [];
        for (let item of notification.streams) {
          result1.push(notification.set(item.name));
        }
        return result1;
      })();
    }
  }, // default value
  "click .bb-notification-controls.dropdown-menu a"(event, template) {
    const $inp = $( event.currentTarget ).find( 'input' );
    const stream = $inp.attr('data-notification-stream');
    notification.set(stream, !notification.get(stream));
    $( event.target ).blur();
    return false;
  },
  "change .bb-notification-controls [data-notification-stream]"(event, template) {
    return notification.set(event.target.dataset.notificationStream, event.target.checked);
  }
});

const round_helper = function() {
  const dir = SORT_REVERSE.get() ? 'desc' : 'asc';
  return Rounds.find({}, {sort: [["sort_key", dir]]});
};
const meta_helper = function() {
  // the following is a map() instead of a direct find() to preserve order
  const r = (() => {
    const result = [];
    for (let index = 0; index < this.puzzles.length; index++) {
      const id = this.puzzles[index];
      const puzzle = Puzzles.findOne({_id: id, puzzles: {$ne: null}});
      if (puzzle == null) { continue; }
      result.push({
        _id: id,
        parent: this._id,
        puzzle,
        num_puzzles: puzzle.puzzles.length
      });
    }
    return result;
  })();
  return r;
};
const unassigned_helper = function() {
  const p = (() => {
    const result = [];
    for (let index = 0; index < this.puzzles.length; index++) {
      const id = this.puzzles[index];
      const puzzle = Puzzles.findOne({_id: id, feedsInto: {$size: 0}, puzzles: {$exists: false}});
      if (puzzle == null) { continue; }
      result.push({ _id: id, parent: this._id, puzzle });
    }
    return result;
  })();
  const editing = Meteor.userId() && (Session.get('canEdit'));
  if (editing || !HIDE_SOLVED.get()) { return p; }
  return p.filter(pp => pp.puzzle.solved == null);
};

//############# groups, rounds, and puzzles ####################
Template.blackboard.helpers({
  rounds: round_helper,
  metas: meta_helper,
  unassigned: unassigned_helper,
  add_round() { return Template.instance().addRound.get(); },
  favorites() {
    const query = { $or: [
      {[`favorites.${Meteor.userId()}`]: true},
      {mechanics: {$in: Meteor.user().favorite_mechanics || []}}
    ]
  };
    if (!Session.get('canEdit') && (HIDE_SOLVED.get() || HIDE_SOLVED_FAVES.get())) {
      query.solved = {$eq: null};
    }
    return Puzzles.find(query);
  },
  stuckPuzzles() { return Puzzles.find({
    'tags.status.value': /^stuck/i}); },
  hasJitsiLocalStorage() {
    return reactiveLocalStorage.getItem('jitsiLocalStorage');
  },
  driveFolder() { return Session.get('RINGHUNTERS_FOLDER'); },
  addingRound() {
    const instance = Template.instance();
    return { done() {
      const wasAdding = instance.addRound.get();
      instance.addRound.set(false);
      return wasAdding;
    }
  };
  }
});

Template.blackboard_status_grid.helpers({
  rounds() { return Rounds.find({}, {sort: [["sort_key", 'asc']]}); },
  metas: meta_helper,
  color() { if (this.puzzle != null) { return puzzleColor(this.puzzle); } },
  unassigned() { 
    return (() => {
      const result = [];
      for (let index = 0; index < this.puzzles.length; index++) {
        const id = this.puzzles[index];
        const puzzle = Puzzles.findOne({_id: id, feedsInto: {$size: 0}, puzzles: {$exists: false}});
        if (puzzle == null) { continue; }
        result.push(puzzle._id);
      }
      return result;
    })();
  },
  puzzles(ps) {
    const p = (ps.map((id, index) => ({
      _id: id,
      puzzle_num: 1 + index,
      puzzle: Puzzles.findOne(id) || { _id: id }
    })));
    return p;
  },
  numSolved(l) { return l.filter(p => p.puzzle.solved).length; },
  stuck: isStuck
});

Template.blackboard.onRendered(function() {
  this.escListener = event => {
    if (!event.key.startsWith('Esc')) { return; }
    return this.$('.bb-menu-drawer').modal('hide');
  };
  this.$('.bb-menu-drawer').on('show', () => document.addEventListener('keydown', this.escListener));
  return this.$('.bb-menu-drawer').on('hide', () => document.removeEventListener('keydown', this.escListener));
});


Template.blackboard.onDestroyed(function() {
  this.$('.bb-menu-drawer').off('show');
  this.$('.bb-menu-drawer').off('hide');
  return document.removeEventListener('keydown', this.escListener);
});

Template.blackboard.events({
  "click .bb-menu-button .btn"(event, template) {
    return template.$('.bb-menu-drawer').modal('show');
  },
  'click .bb-menu-drawer a.bb-clear-jitsi-storage'(event, template) {
    return reactiveLocalStorage.removeItem('jitsiLocalStorage');
  },
  'click .bb-menu-drawer a'(event, template) {
    template.$('.bb-menu-drawer').modal('hide');
    const href = event.target.getAttribute('href');
    if (href.match(/^#/)) {
      event.preventDefault();
      return $(href).get(0)?.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
  }
});

Template.blackboard.onRendered(function() {
  //  page title
  $("title").text(`${TEAM_NAME} Puzzle Blackboard`);
  return $('#bb-tables .bb-puzzle .puzzle-name > a').tooltip({placement: 'left'});
});

Template.blackboard.events({
  "click .bb-sort-order button"(event, template) {
    const reverse = $(event.currentTarget).attr('data-sortReverse') === 'true';
    return SORT_REVERSE.set(reverse);
  },
  "click .bb-add-round"(event, template) { return template.addRound.set(true); },
  'click .bb-canEdit .bb-fix-drive'(event, template) {
    event.stopPropagation(); // keep .bb-editable from being processed!
    return Meteor.call('fixPuzzleFolder', {
      object: this.puzzle._id,
      name: this.puzzle.name
    }
    );
  }
});

Template.blackboard_favorite_puzzle.onCreated(function() {
  return this.autorun(() => {
    if (!VISIBLE_COLUMNS.get().includes('update')) { return; }
    return this.subscribe('last-puzzle-room-message', Template.currentData()._id);
  });
});

Template.blackboard_round.onCreated(function() {
  this.addingTag = new ReactiveVar(false);
  this.addingUnassigned = new ReactiveVar(false);
  return this.addingMeta = new ReactiveVar(false);
});

Template.blackboard_round.helpers({
  // the following is a map() instead of a direct find() to preserve order
  metas() {
    const r = (() => {
      const result = [];
      for (let index = 0; index < this.puzzles.length; index++) {
        const id = this.puzzles[index];
        const puzzle = Puzzles.findOne({_id: id, puzzles: {$ne: null}});
        if (puzzle == null) { continue; }
        result.push({
          _id: id,
          puzzle,
          num_puzzles: puzzle.puzzles.length,
          num_solved: Puzzles.find({_id: {$in: puzzle.puzzles}, solved: {$ne: null}}).length
        });
      }
      return result;
    })();
    if (SORT_REVERSE.get()) { r.reverse(); }
    return r;
  },
  collapsed() { return 'true' === reactiveLocalStorage.getItem(`collapsed_round.${this._id}`); },
  unassigned: unassigned_helper,
  showRound() {
    if ('true' === Session.get('canEdit')) { return true; }
    if (!HIDE_SOLVED_METAS.get()) { return true; }
    for (let index = 0; index < this.puzzles.length; index++) {
      const id = this.puzzles[index];
      const puzzle = Puzzles.findOne({_id: id, solved: {$eq: null}, $or: [{feedsInto: {$size: 0}}, {puzzles: {$ne: null}}]});
      if (puzzle != null) { return true; }
    }
    return false;
  },
  addingTag() {
    const instance = Template.instance();
    return {
      adding() { return instance.addingTag.get(); },
      done() { return instance.addingTag.set(false); }
    };
  },
  addingUnassigned() { return Template.instance().addingUnassigned.get(); },
  addingUnassignedParams() {
    const instance = Template.instance();
    return {
      done() {
        const wasAdding = instance.addingUnassigned.get();
        instance.addingUnassigned.set(false);
        return wasAdding;
      },
      params: {
        round: this._id
      }
    };
  },
  addingMeta() { return Template.instance().addingMeta.get(); },
  addingMetaParams() {
    const instance = Template.instance();
    return {
      done() {
        const wasAdding = instance.addingMeta.get();
        instance.addingMeta.set(false);
        return wasAdding;
      },
      params: {
        round: this._id,
        puzzles: []
      }
    };
  }});

const moveBeforePrevious = function(match, rel, event, template) {
  const row = template.$(event.target).closest(match);
  const prevRow = row.prev(match);
  if (prevRow.length !== 1) { return; }
  const args = {};
  args[rel] = prevRow[0].dataset.puzzleId;
  return Meteor.call('moveWithinRound', row[0]?.dataset.puzzleId, Template.parentData()._id, args);
};

const moveAfterNext = function(match, rel, event, template) {
  const row = template.$(event.target).closest(match);
  const nextRow = row.next(match);
  if (nextRow.length !== 1) { return; }
  const args = {};
  args[rel] = nextRow[0].dataset.puzzleId;
  return Meteor.call('moveWithinRound', row[0]?.dataset.puzzleId, Template.parentData()._id, args);
};

Template.blackboard_round.events({
  'click .bb-round-buttons .bb-add-tag'(event, template) {
    return template.addingTag.set(true);
  },
  'click .bb-round-buttons .bb-move-down'(event, template) {
    const dir = SORT_REVERSE.get() ? -1 : 1;
    return Meteor.call('moveRound', template.data._id, dir);
  },
  'click .bb-round-buttons .bb-move-up'(event, template) {
    const dir = SORT_REVERSE.get() ? 1 : -1;
    return Meteor.call('moveRound', template.data._id, dir);
  },
  'click .bb-round-header.collapsed .collapse-toggle'(event, template) {
    return reactiveLocalStorage.setItem(`collapsed_round.${template.data._id}`, false);
  },
  'click .bb-round-header:not(.collapsed) .collapse-toggle'(event, template) {
    return reactiveLocalStorage.setItem(`collapsed_round.${template.data._id}`, true);
  },
  async 'click .bb-round-header .bb-delete-icon'(event, template) {
    event.stopPropagation();
    if (await confirm({
      ok_button: 'Yes, delete it',
      no_button: 'No, cancel',
      message: `Are you sure you want to delete the round \"${template.data.name}\"?`
    })) {
      return Meteor.call('deleteRound', template.data._id);
    }
  },
  
  'click .bb-round-buttons .bb-add-puzzle'(event, template) { return template.addingUnassigned.set(true); },
  'click .bb-round-buttons .bb-add-meta:not(.active)'(event, template) { return template.addingMeta.set(true); },
  'click tbody.unassigned tr.puzzle .bb-move-up': moveBeforePrevious.bind(null, 'tr.puzzle', 'before'),
  'click tbody.unassigned tr.puzzle .bb-move-down': moveAfterNext.bind(null, 'tr.puzzle', 'after')
});

Template.blackboard_meta.onCreated(function() {
  return this.adding = new ReactiveVar(false);
});

const moveWithinMeta = pos => (function(event, template) { 
  const meta = template.data;
  return Meteor.call('moveWithinMeta', this.puzzle._id, meta.puzzle._id, {pos});
});

Template.blackboard_meta.events({
  'click tbody.meta tr.puzzle .bb-move-up': moveWithinMeta(-1),
  'click tbody.meta tr.puzzle .bb-move-down': moveWithinMeta(1),
  'click tbody.meta tr.meta .bb-move-up'(event, template) {
    let rel = 'before';
    if (SORT_REVERSE.get()) {
      rel = 'after';
    }
    return moveBeforePrevious('tbody.meta', rel, event, template);
  },
  'click tbody.meta tr.meta .bb-move-down'(event, template) {
    let rel = 'after';
    if (SORT_REVERSE.get()) {
      rel = 'before';
    }
    return moveAfterNext('tbody.meta', rel, event, template);
  },
  'click .bb-meta-buttons .bb-add-puzzle:not(.active)'(event, template) {
    return template.adding.set(true);
  },
  'click tr.meta.collapsed .collapse-toggle'(event, template) {
    return reactiveLocalStorage.setItem(`collapsed_meta.${template.data.puzzle._id}`, false);
  },
  'click tr.meta:not(.collapsed) .collapse-toggle'(event, template) {
    return reactiveLocalStorage.setItem(`collapsed_meta.${template.data.puzzle._id}`, true);
  }
});

Template.blackboard_meta.helpers({
  color() { if (this.puzzle != null) { return puzzleColor(this.puzzle); } },
  showMeta() { return !HIDE_SOLVED_METAS.get() || ((this.puzzle?.solved == null)); },
  puzzles() {
    let filter;
    const puzzle = Puzzles.findOne({_id: this._id}, {fields: {order_by: 1, puzzles: 1}});
    if (puzzle?.order_by) {
      filter =
        {feedsInto: this._id};
      if (!(Session.get('canEdit')) && HIDE_SOLVED.get()) {
        filter.solved = {$eq: null};
      }
      return Puzzles.find(filter, {
        sort: {[puzzle.order_by]: 1},
        transform(p) { return {_id: p._id, puzzle: p}; }
      });
    }
    const p = ((puzzle?.puzzles || []).map((id, index) => ({
      _id: id,
      puzzle: Puzzles.findOne(id) || { _id: id }
    })));
    const editing = Meteor.userId() && (Session.get('canEdit'));
    if (editing || !HIDE_SOLVED.get()) { return p; }
    return p.filter(pp => pp.puzzle.solved == null);
  },
  stuck: isStuck,
  numHidden() {
    if (!HIDE_SOLVED.get()) { return 0; }
    const y = (() => {
      const result = [];
      for (let index = 0; index < this.puzzle.puzzles.length; index++) {
        const id = this.puzzle.puzzles[index];
        const x = Puzzles.findOne(id);
        if (x?.solved == null) { continue; } else {
          result.push(undefined);
        }
      }
      return result;
    })();
    return y.length;
  },
  collapsed() { return 'true' === reactiveLocalStorage.getItem(`collapsed_meta.${this.puzzle._id}`); },
  adding() { return Template.instance().adding.get(); },
  addingPuzzle() {
    const instance = Template.instance();
    const parentData = Template.parentData();
    return {
      done() {
        const wasAdding = instance.adding.get();
        instance.adding.set(false);
        return wasAdding;
      },
      params: {
        round: parentData._id,
        feedsInto: [this.puzzle._id]
      }
    };
  }});

Template.blackboard_puzzle_cells.events({
  'click .bb-puzzle-add-move .bb-add-tag'(event, template) {
    return template.addingTag.set(true);
  },
  'change .bb-set-is-meta'(event, template) {
    if (event.target.checked) {
      return Meteor.call('makeMeta', template.data.puzzle._id);
    } else {
      return Meteor.call('makeNotMeta', template.data.puzzle._id);
    }
  },
  'click .bb-feed-meta a[data-puzzle-id]'(event, template) {
    Meteor.call('feedMeta', template.data.puzzle._id, event.target.dataset.puzzleId);
    return event.preventDefault();
  },
  'click button[data-sort-order]'(event, template) {
    return Meteor.call('setField', {
      type: 'puzzles',
      object: template.data.puzzle._id,
      fields: { order_by: event.currentTarget.dataset.sortOrder
    }
    }
    );
  },
  async 'click .bb-puzzle-title .bb-delete-icon'(event, template) {
    event.stopPropagation();
    if (await confirm({
      ok_button: 'Yes, delete it',
      no_button: 'No, cancel',
      message: `Are you sure you want to delete the puzzle \"${template.data.puzzle.name}\"?`
    })) {
      return Meteor.call('deletePuzzle', template.data.puzzle._id);
    }
  }
});

Template.blackboard_puzzle_cells.onCreated(function() {
  return this.addingTag = new ReactiveVar(false);
});

Template.blackboard_puzzle_cells.helpers({
  allMetas() {
    if (!this) { return []; }
    return this.feedsInto.map((x) => (Puzzles.findOne(x)));
  },
  otherMetas() {
    const parent = Template.parentData(2);
    if (!parent.puzzle) { return; }
    if (this.feedsInto == null) { return; }
    if (this.feedsInto.length < 2) { return; }
    return Puzzles.find({_id: { $in: this.feedsInto, $ne: parent.puzzle._id }});
  },
  isMeta() { return (this.puzzles != null); },
  canChangeMeta() { return !this.puzzles || (this.puzzles.length === 0); },
  unfedMetas() {
    return Puzzles.find({puzzles: {$exists: true, $ne: this._id}});
  },
  jitsiLink() {
    return jitsiUrl("puzzles", this.puzzle?._id);
  },
  addingTag() {
    const instance = Template.instance();
    return {
      adding() { return instance.addingTag.get(); },
      done() { return instance.addingTag.set(false); }
    };
  }});

Template.blackboard_column_body_answer.helpers({
  answer() { return (getTag(this.puzzle, 'answer')) || ''; }});

Template.blackboard_column_body_status.helpers({
  status() { return (getTag(this.puzzle, 'status')) || ''; },
  set_by() { return this.puzzle?.tags?.status?.touched_by; }
});

Template.blackboard_column_body_update.helpers({
  stuck: isStuck,
  solverMinutes() {
    if (this.puzzle.solverTime == null) { return; }
    return Math.floor(this.puzzle.solverTime / 60000);
  },
  new_message() {
    return (this.puzzle.last_read_timestamp == null) || (this.puzzle.last_read_timestamp < this.puzzle.last_message_timestamp);
  }
});

Template.blackboard_column_body_working.helpers({
  whos_working() {
    if (this.puzzle == null) { return []; }
    return findByChannel(`puzzles/${this.puzzle._id}`, {}, {sort: {jitsi: -1, joined_timestamp: 1}});
  }});

const colorHelper = function() { return getTag(this, 'color'); };

Template.blackboard_othermeta_link.helpers({color: colorHelper});
Template.blackboard_addmeta_entry.helpers({color: colorHelper});

Template.blackboard_unfeed_meta.events({
  'click .bb-unfeed-icon'(event, template) {
    return Meteor.call('unfeedMeta', template.data.puzzle._id, template.data.meta._id);
  }
});

let dragdata = null;

Template.blackboard_puzzle.helpers({
  stuck: isStuck});

Template.blackboard_puzzle.events({
  'dragend tr.puzzle'(event, template) {
    return dragdata = null;
  },
  'dragstart tr.puzzle'(event, template) {
    if (!Session.get('canEdit')) { return; }
    event = event.originalEvent;
    return dragdata = new PuzzleDrag(this.puzzle, Template.parentData(1).puzzle, Template.parentData(2), event.target, event.clientY, event.dataTransfer);
  },
  'dragover tr.puzzle'(event, template) {
    if (!Session.get('canEdit')) { return; }
    event = event.originalEvent;
    if (dragdata?.dragover(template.data.puzzle, Template.parentData(1).puzzle, Template.parentData(2), event.target, event.clientY, event.dataTransfer)) {
      return event.preventDefault();
    }
  }
});

Template.blackboard_column_header_working.onCreated(function() {
  return this.autorun(() => {
    return this.subscribe('all-presence');
  });
});

// Update 'currentTime' every minute or so to allow pretty_ts to magically
// update
Meteor.startup(function() {
  Session.set("currentTime", Date.now()); 
  return Meteor.setInterval(() => Session.set("currentTime", Date.now())
  , 60*1000);
});
