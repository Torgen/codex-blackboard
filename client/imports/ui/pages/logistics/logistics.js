/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './logistics.html';
import './logistics.less';
import '/client/imports/ui/components/create_object/create_object.coffee';
import '/client/imports/ui/components/fix_puzzle_drive/fix_puzzle_drive.coffee';
import { CalendarEvents, CallIns, Puzzles, Rounds } from '/lib/imports/collections.coffee';
import { confirm } from '/client/imports/modal.coffee';
import { findByChannel } from '/client/imports/presence_index.coffee';
import colorFromThingWithTags from '/client/imports/objectColor.coffee';
import { isStuck } from '/lib/imports/tags.coffee';

const nameAndUrlFromDroppedLink = function(dataTransfer) {
  const url = dataTransfer.getData('url');
  const name = (() => {
    if (dataTransfer.types.includes('text/html')) {
    const doc = new DOMParser().parseFromString(dataTransfer.getData('text/html'), 'text/html');
    return doc.body.innerText.trim();
  } else {
    const parsedUrl = new URL(link);
    return parsedUrl.pathname().split('/').at(-1);
  }
  })();
  return {name, url};
};

const PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle';
const CALENDAR_EVENT_MIME_TYPE = 'application/prs.codex-calendar-event';

const draggedPuzzle = new ReactiveDict;
const editingPuzzle = new ReactiveVar;

Template.logistics.onCreated(function() {
  Session.set('topRight', 'logistics_topright_panel');
  // This is tristate because if you click the button while it's open, you expect it to close,
  // but the click is received after the focusout event on the contents closes it, which
  // reopens it.
  this.creatingRound = new ReactiveVar(0);
  // for meta and puzzle the above isn't necessary because the text box is outside the dropdown
  // These store the round the meta/puzzle are being created in.
  this.creatingMeta = new ReactiveVar(null);
  this.creatingPuzzle = new ReactiveVar(null);
  return this.autorun(() => {
    this.subscribe('all-presence');
    return this.subscribe('callins');
  });
});

Template.logistics.onRendered(function() {
  $("title").text("Logistics");
  return this.autorun(() => {
    if (editingPuzzle.get() != null) {
      this.$('#bb-logistics-edit-dialog').modal('show');
      return $(document).on('keydown.dismiss-edit-dialog', e => {
        if (e.which === 27) {
          return this.$('#bb-logistics-edit-dialog').modal('hide');
        }
      });
    }
  });
});

Template.logistics.helpers({
  rounds() {
    return Rounds.find({}, {sort: {sort_key: 1}});
  },
  standalone(round) {
    const x = [];
    for (let puzzle of round.puzzles) {
      const puz = Puzzles.findOne({_id: puzzle});
      if ((puz.feedsInto.length === 0) && (puz.puzzles == null)) { x.push(puz); }
    }
    if (x.length) { return x; }
  },
  metas(round) {
    const x = [];
    for (let puzzle of round.puzzles) {
      const puz = Puzzles.findOne({_id: puzzle});
      if (puz.puzzles != null) { x.push(puz); }
    }
    return x;
  },
  metaParams(round) { return { round, puzzles: [] }; },
  puzzleParams(round) { return { round }; },
  creatingRound() { return Template.instance().creatingRound.get() === 2; },
  doneCreatingRound() {
    const instance = Template.instance();
    return { done() {
      const wasStillCreating = instance.creatingRound.get();
      instance.creatingRound.set(0);
      return wasStillCreating === 2;
    }
  };
  },
  creatingMeta() { return Template.instance().creatingMeta.get(); },
  doneCreatingMeta() {
    const instance = Template.instance();
    return { done() {
      const wasStillCreating = instance.creatingMeta.get();
      instance.creatingMeta.set(null);
      return (wasStillCreating != null);
    }
  };
  },
  creatingStandalone() { return Template.instance().creatingPuzzle.get(); },
  doneCreatingStandalone() {
    const instance = Template.instance();
    return { done() {
      const wasStillCreating = instance.creatingPuzzle.get();
      instance.creatingPuzzle.set(null);
      return (wasStillCreating != null);
    }
  };
  },
  unfeeding() {
    if ((draggedPuzzle.get('meta') != null) && (draggedPuzzle.get('targetMeta') == null)) {
      const puzz = Puzzles.findOne({_id: draggedPuzzle.get('id')});
      if (puzz?.feedsInto.length === 1) { return puzz; }
    }
  },
  editingPuzzle() {
    const _id = editingPuzzle.get();
    if (_id != null) {
      return Puzzles.findOne({_id});
    }
  },
  modalColor() {
    const p = Puzzles.findOne({_id: editingPuzzle.get()});
    if (p != null) { return colorFromThingWithTags(p); }
  }
});


const allowDropUriList = function(event, template) {
  if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
    return;
  }
  if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
    event.preventDefault();
    event.stopPropagation();
    return event.originalEvent.dataTransfer.dropEffect = 'copy';
  }
};

let lastEnter = null;

const toggleButtonOnDragEnter = function(event, template) {
  if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
    return;
  }
  if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
    if (!event.currentTarget.classList.contains('open')) {
      $(event.currentTarget).dropdown('toggle');
    }
    event.currentTarget.classList.add('dragover');
    return lastEnter = event.target;
  }
};

const closeButtonOnDragLeave = function(event, template) {
  if (event.target === lastEnter) {
    lastEnter = null;
  } else if (event.currentTarget.contains(lastEnter)) {
    return;
  }
  if (event.currentTarget.classList.contains('open')) {
    $(event.currentTarget).dropdown('toggle');
  }
  return event.currentTarget.classList.remove('dragover');
};

const makePuzzleOnDrop = function(targetId, puzzleParams) {
  return Template.logistics.events({
    [`drop #${targetId} .round-name`](event, template) {
      event.currentTarget.closest('##{targetId}').classList.remove('dragover');
      if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
        return;
      }
      if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
        event.preventDefault();
        const {name, url} = nameAndUrlFromDroppedLink(event.originalEvent.dataTransfer);
        return Meteor.call('newPuzzle', {name, link: url, round: this._id, ...puzzleParams});
      }
    }});
};
makePuzzleOnDrop('bb-logistics-new-standalone', {});
makePuzzleOnDrop('bb-logistics-new-meta', {puzzles: []});

Template.logistics.events({
  'mousedown #bb-logistics-new-round:not(.open)'(event, template) {
    return template.creatingRound.set(1);
  },
  'click #bb-logistics-new-round'(event, template) {
    if (template.creatingRound.get() === 1) {
      return template.creatingRound.set(2);
    }
  },
  'click .dropdown-menu.stay-open'(event, template) {
    return event.stopPropagation();
  },
  'click #bb-logistics-new-meta a.round-name'(event, template) {
    return template.creatingMeta.set(this._id);
  },
  'click #bb-logistics-new-standalone a.round-name'(event, template) {
    return template.creatingPuzzle.set(this._id);
  },
    
  'dragstart .bb-logistics-standalone .puzzle'(event, template) {
    const data = {id: this._id, meta: null};
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(PUZZLE_MIME_TYPE, JSON.stringify(data));
    return event.originalEvent.dataTransfer.effectAllowed = 'all';
  },
  'dragstart .bb-calendar-event'(event, template) {
    event.originalEvent.dataTransfer.setData(CALENDAR_EVENT_MIME_TYPE, this.event._id);
    return event.originalEvent.dataTransfer.effectAllowed = 'link';
  },
  'dragend .bb-logistics-standalone .puzzle'(event, template) {
    return draggedPuzzle.clear();
  },
  'dragover .bb-logistics'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      if (draggedPuzzle.get('meta') != null) {
        event.originalEvent.dataTransfer.dropEffect = 'move';
      } else {
        event.originalEvent.dataTransfer.dropEffect = 'none';
      }
    } else {
      event.originalEvent.dataTransfer.dropEffect = 'none';
    }
    event.stopPropagation();
    return event.preventDefault();
  },
  'dragover #bb-logistics-new-round': allowDropUriList,
  'dragover #bb-logistics-new-meta .round-name': allowDropUriList,
  'dragover #bb-logistics-new-standalone .round-name': allowDropUriList,
  'dragover #bb-logistics-delete'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.originalEvent.dataTransfer.dropEffect = 'move';
      event.stopPropagation();
      return event.preventDefault();
    }
  },
  'dragenter li:not(.disabled)'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      return event.currentTarget.classList.add('active');
    }
  },
  'dragleave li:not(.disabled)'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      return event.currentTarget.classList.remove('active');
    }
  },
  'dragenter #bb-logistics-new-round': toggleButtonOnDragEnter,
  'dragenter #bb-logistics-new-meta': toggleButtonOnDragEnter,
  'dragenter #bb-logistics-new-standalone': toggleButtonOnDragEnter,
  'dragenter #bb-logistics-delete'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.currentTarget.classList.add('dragover');
      lastEnter = event.target;
      return draggedPuzzle.set('willDelete', true);
    }
  },

  'dragleave #bb-logistics-new-round': closeButtonOnDragLeave,
  'dragleave #bb-logistics-new-meta': closeButtonOnDragLeave,
  'dragleave #bb-logistics-new-standalone': closeButtonOnDragLeave,
  'dragleave #bb-logistics-delete'(event, template) {
    if (event.target === lastEnter) {
      lastEnter = null;
    } else if (event.currentTarget.contains(lastEnter)) {
      return;
    }
    event.currentTarget.classList.remove('dragover');
    return draggedPuzzle.set('willDelete', false);
  },
  'drop .bb-logistics'(event, template) {
    if (!event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) { return; }
    event.preventDefault();
    event.stopPropagation();
    const data = JSON.parse(event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE));
    if (data.meta != null) {
      return Meteor.call('unfeedMeta', data.id, data.meta);
    }
  },
  
  'drop #bb-logistics-new-round'(event, template) {
    event.currentTarget.classList.remove('dragover');
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      return;
    }
    if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      event.preventDefault();
      const {name, url} = nameAndUrlFromDroppedLink(event.originalEvent.dataTransfer);
      return Meteor.call('newRound', {
        name,
        link: url
      }
      );
    }
  },
  'drop #bb-logistics-new-meta, drop #bb-logistics-new-standalone'(event, template) {
    lastEnter = null;
    event.currentTarget.classList.remove('dragover');
    if (event.currentTarget.classList.contains('open')) {
      return $(event.currentTarget).dropdown('toggle');
    }
  },
  async 'drop #bb-logistics-delete'(event, template) {
    event.currentTarget.classList.remove('dragover');
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.preventDefault();
      event.stopPropagation();
      const data = JSON.parse(event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE));
      const puzzle = Puzzles.findOne({_id: data.id});
      if (puzzle != null) {
        if (await confirm({
          ok_button: 'Yes, delete it',
          no_button: 'No, cancel',
          message: `Are you sure you want to delete the puzzle \"${puzzle.name}\"?`
        })) {
          return Meteor.call('deletePuzzle', puzzle._id);
        }
      }
    }
  },
  'hidden #bb-logistics-edit-dialog'(event, template) {
    editingPuzzle.set(null);
    return $(document).off('keydown.dismiss-edit-dialog');
  }
});

Template.logistics_puzzle.helpers({
  stuck: isStuck,
  willDelete() {
    if (!draggedPuzzle.equals('id', this._id)) {
      return false;
    }
    if (draggedPuzzle.get('willDelete')) { 
      return true;
    }
    const targetMeta = draggedPuzzle.get('targetMeta');
    if (targetMeta != null) {
      return this.feedsInto.length === 0;
    } else {
      return draggedPuzzle.equals('meta', Template.parentData()?.meta?._id);
    }
  },
  draggingIn() {
    const localMeta = Template.parentData()?.meta;
    if (localMeta == null) { return false; }
    return draggedPuzzle.equals('id', this._id) && draggedPuzzle.equals('targetMeta',localMeta._id) && !this.feedsInto.includes(draggedPuzzle.get('targetMeta'));
  }
});

Template.logistics_puzzle.events({
  'click .bb-logistics-edit-puzzle'(event, template) {
    if (event.button !== 0) { return; }
    if (event.ctrlKey || event.altKey || event.metaKey) { return; }
    event.preventDefault();
    event.stopPropagation();
    return editingPuzzle.set(this._id);
  },
  'dragover .puzzle'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)) {
      event.originalEvent.dataTransfer.dropEffect = 'link';
      event.preventDefault();
      return event.stopPropagation();
    }
  },
  'drop .puzzle'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)) {
      const id = event.originalEvent.dataTransfer.getData(CALENDAR_EVENT_MIME_TYPE);
      Meteor.call('setPuzzleForEvent', id, this._id);
      event.preventDefault();
      return event.stopPropagation();
    }
  }
});

Template.logistics_puzzle_events.helpers({
  soonest_ending_current_event() {
    const now = Session.get('currentTime');
    return CalendarEvents.findOne({puzzle: this._id, start: {$lt: now}, end: {$gt: now}}, {sort: {end: -1}});
  },
  next_future_event() {
    const now = Session.get('currentTime');
    return CalendarEvents.findOne({puzzle: this._id, start: {$gt: now}}, {sort: {start: 1}});
  },
  no_events() {
    return CalendarEvents.find({puzzle: this._id}).count() === 0;
  }
});

Template.logistics_meta.onCreated(function() {
  this.creatingFeeder = new ReactiveVar(false);
  return this.draggingLink = new ReactiveVar(false);
});

Template.logistics_meta.events({
  'click .new-puzzle'(event, template) {
    return template.creatingFeeder.set(true);
  },
  'click header .bb-logistics-edit-puzzle'(event, template) {
    if (event.button !== 0) { return; }
    if (event.ctrlKey || event.altKey || event.metaKey) { return; }
    event.preventDefault();
    event.stopPropagation();
    return editingPuzzle.set(this.meta._id);
  },
  'dragstart .feeders .puzzle'(event, template) {
    const data = {id: this._id, meta: template.data.meta._id, targetMeta: template.data.meta._id};
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(PUZZLE_MIME_TYPE, JSON.stringify(data));
    return event.originalEvent.dataTransfer.effectAllowed = 'all';
  },
  'dragstart header .meta'(event, template) {
    const data = {id: this.meta._id, meta: null};
    draggedPuzzle.set(data);
    event.originalEvent.dataTransfer.setData(PUZZLE_MIME_TYPE, JSON.stringify(data));
    return event.originalEvent.dataTransfer.effectAllowed = 'all';
  },
  'dragend .feeders .puzzle, dragend .meta'(event, template) {
    return draggedPuzzle.clear();
  },
  'dragover header .meta'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)) {
      event.originalEvent.dataTransfer.dropEffect = 'link';
      event.preventDefault();
      return event.stopPropagation();
    }
  },
  'dragover .bb-logistics-meta'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      if (draggedPuzzle.equals('meta', template.data.meta._id)) {
        event.originalEvent.dataTransfer.dropEffect = 'none';
      } else {
        event.originalEvent.dataTransfer.dropEffect = 'link';
      }
    } else if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      event.originalEvent.dataTransfer.dropEffect = 'copy';
    } else { return; }
    event.preventDefault();
    return event.stopPropagation();
  },
  'dragenter .bb-logistics-meta'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      draggedPuzzle.set('targetMeta', this.meta._id);
    } else if (!event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      return;
    }
    return template.draggingLink.set(event.target);
  },
  'dragleave .bb-logistics-meta'(event, template) {
    if (template.draggingLink.get() !== event.target) { return; }
    template.draggingLink.set(null);
    return draggedPuzzle.set('targetMeta', null);
  },
  'drop header .meta'(event, template) {
    if (event.originalEvent.dataTransfer.types.includes(CALENDAR_EVENT_MIME_TYPE)) {
      const id = event.originalEvent.dataTransfer.getData(CALENDAR_EVENT_MIME_TYPE);
      Meteor.call('setPuzzleForEvent', id, this.meta._id);
      event.preventDefault();
      return event.stopPropagation();
    }
  },
  'drop .bb-logistics-meta'(event, template) {
    template.draggingLink.set(null);
    if (event.originalEvent.dataTransfer.types.includes(PUZZLE_MIME_TYPE)) {
      event.preventDefault();
      event.stopPropagation();
      const data = JSON.parse(event.originalEvent.dataTransfer.getData(PUZZLE_MIME_TYPE));
      if (data.meta === template.data.meta._id) { return; }
      return Meteor.call('feedMeta', data.id, template.data.meta._id);
    } else if (event.originalEvent.dataTransfer.types.includes('text/uri-list')) {
      event.preventDefault();
      const {name, url} = nameAndUrlFromDroppedLink(event.originalEvent.dataTransfer);
      return Meteor.call('newPuzzle', {
        name,
        link: url,
        feedsInto: [this.meta._id],
        round: this.round._id
      }
      );
    }
  }
});

Template.logistics_meta.helpers({
  color() { return colorFromThingWithTags(this.meta); },
  puzzles() { return this.meta.puzzles.map(_id => Puzzles.findOne({_id})); },
  stuck: isStuck,
  feederParams() {
    return {
      round: this.round._id,
      feedsInto: [this.meta._id]
    };
  },
  creatingFeeder() { return Template.instance().creatingFeeder.get(); },
  draggingLink() { return Template.instance().draggingLink.get(); },
  doneCreatingFeeder() {
    const instance = Template.instance();
    return { done() {
      const wasStillCreating = instance.creatingFeeder.get();
      instance.creatingFeeder.set(false);
      return wasStillCreating;
    }
  };
  },
  willDelete() {
    return draggedPuzzle.get('willDelete') && draggedPuzzle.equals('id', this.meta._id);
  },
  fromAnotherMeta() {
    return !draggedPuzzle.equals('meta', this.meta._id);
  },
  draggedPuzzle() { return Puzzles.findOne({_id: draggedPuzzle.get('id')}); }
});

Template.logistics_puzzle_presence.helpers({
  presenceForScope(scope) {
    return findByChannel(`puzzles/${this._id}`, {[scope]: 1}, {fields: {[scope]: 1}}).count();
  }
});

Template.logistics_callins_table.helpers({
  callins() {
    return CallIns.find({status: 'pending'}, {
      sort: [["created","asc"]],
      transform(c) {
        c.puzzle = c.target ? Puzzles.findOne({_id: c.target}) : undefined;
        return c;
      }
    }
    );
  }
});

Template.logistics_callin_row.helpers({
  lastAttempt() {
    if (this.puzzle == null) { return null; }
    return CallIns.findOne({target_type: 'puzzles', target: this.puzzle._id, status: 'rejected'}, {
      sort: { resolved: -1
    },
      limit: 1,
      fields: { resolved: 1
    }
    }
    )
    ?.resolved;
  },
    
  hunt_link() { return this.puzzle?.link; },
  solved() { return this.puzzle?.solved; },
  alreadyTried() {
    if (this.puzzle == null) { return; }
    return (CallIns.findOne({target_type: 'puzzles', target: this.puzzle._id, status: 'rejected', answer: this.answer},
      {fields: {}}
    ) != null);
  },
  callinTypeIs(type) { return this.callin_type === type; }
});

Template.logistics_callin_row.events({
  "change .bb-submitted-to-hq"(event, template) {
    const checked = !!event.currentTarget.checked;
    return Meteor.call('setField', {
      type: 'callins',
      object: this._id,
      fields: {
        submitted_to_hq: checked,
        submitted_by: checked ? Meteor.userId() : null
      }
    }
    );
  }
});
