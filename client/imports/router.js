// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

import { INITIAL_CHAT_LIMIT } from '/client/imports/server_settings.coffee';
import { awaitBundleLoaded } from '/client/imports/ui/pages/logistics/logistics_page.coffee';

const distToTop = x => Math.abs(x.getBoundingClientRect().top - 110);

const closestToTop = function() {
  if (!Session.equals('currentPage', 'blackboard')) { return; }
  let nearTop = $('#bb-tables')[0];
  if (!nearTop) { return; }
  let minDist = distToTop(nearTop);
  $('#bb-tables table [id]').each(function(i, e) {
    const dist = distToTop(e);
    if (dist < minDist) {
      nearTop = e;
      return minDist = dist;
    }
  });
  return nearTop;
};

const scrollAfter = function(x) {
  const nearTop = closestToTop();
  const offset = nearTop?.getBoundingClientRect().top;
  x();
  if (nearTop != null) {
    return Tracker.afterFlush(() => $(`#${nearTop.id}`).get(0).scrollIntoView({
      behavior: 'smooth'}));
  }
};

// Router
const BlackboardRouter = Backbone.Router.extend({
  routes: {
    "": "BlackboardPage",
    "graph": "GraphPage",
    "map": "MapPage",
    "edit": "EditPage",
    "rounds/:round": "RoundPage",
    "puzzles/:puzzle": "PuzzlePage",
    "puzzles/:puzzle/:view": "PuzzlePage",
    "chat/:type/:id": "ChatPage",
    "oplogs": "OpLogPage",
    "facts": "FactsPage",
    "statistics": "StatisticsPage",
    "logistics": 'LogisticsPage',
    'callins': 'LogisticsRedirect',
    "projector": "ProjectorPage"
  },

  BlackboardPage() {
    return scrollAfter(() => {
      this.Page("blackboard", "general", "0", true, true);
      return Session.set({
        color: 'inherit',
        canEdit: undefined,
        topRight: 'blackboard_status_grid'
      });
    });
  },

  EditPage() {
    return scrollAfter(() => {
      this.Page("blackboard", "general", "0", true, true);
      return Session.set({
        color: 'inherit',
        canEdit: true,
        topRight: 'blackboard_status_grid'
      });
    });
  },

  GraphPage() { return this.Page('graph', 'general', '0', false); },

  MapPage() { return this.Page('map', 'general', '0', false); },

  async LogisticsPage() {
    this.Page('logistics_page', 'general', '0', true, true);
    return await awaitBundleLoaded();
  },

  LogisticsRedirect() { return this.navigate('/logistics', {trigger: true, replace: true}); },

  ProjectorPage() { return this.Page('projector', 'general', '0', false); },

  PuzzlePage(id, view=null) {
    this.Page("puzzle", "puzzles", id, true, true);
    return Session.set({
      timestamp: 0,
      view
    });
  },

  RoundPage(id) {
    return this.goToChat("rounds", id, 0);
  },

  ChatPage(type,id) {
    if (type === "general") { id = "0"; }
    return this.Page("chat", type, id, true);
  },

  OpLogPage() {
    return this.Page("oplog", "oplog", "0", false);
  },

  FactsPage() {
    return this.Page("facts", "facts", "0", false);
  },

  StatisticsPage() {
    return this.Page("statistics", "general", "0", false);
  },

  Page(page, type, id, has_chat, splitter) {
    const old_room = Session.get('room_name');
    const new_room = has_chat ? `${type}/${id}` : null;
    if (old_room !== new_room) {
      // if switching between a puzzle room and full-screen chat, don't reset limit.
      Session.set({
        room_name: new_room,
        limit: INITIAL_CHAT_LIMIT
      });
    }
    Session.set({
      splitter: splitter ?? false,
      currentPage: page,
      type,
      id
    });
    // cancel modals if they were active
    return $('.modal').modal('hide');
  },

  urlFor(type,id) {
    return Meteor._relativeToSiteRootUrl(`/${type}/${id}`);
  },
  chatUrlFor(type, id) {
    return (Meteor._relativeToSiteRootUrl(`/chat${this.urlFor(type,id)}`));
  },

  goTo(type,id) {
    return this.navigate(this.urlFor(type,id), {trigger:true});
  },

  goToRound(round) { return this.goTo("rounds", round._id); },

  goToPuzzle(puzzle) {  return this.goTo("puzzles", puzzle._id); },

  goToChat(type, id) {
    return this.navigate(this.chatUrlFor(type, id), {trigger:true});
  }
});

export default new BlackboardRouter();
