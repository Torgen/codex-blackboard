import { INITIAL_CHAT_LIMIT } from "/client/imports/server_settings.js";
import { awaitBundleLoaded } from "/client/imports/ui/pages/logistics/logistics_page.js";

const distToTop = (x) => Math.abs(x.getBoundingClientRect().top - 110);

function closestToTop() {
  if (!Session.equals("currentPage", "blackboard")) {
    return;
  }
  let nearTop = $("#bb-tables")[0];
  if (!nearTop) {
    return;
  }
  let minDist = distToTop(nearTop);
  $("#bb-tables table [id]").each(function (i, e) {
    const dist = distToTop(e);
    if (dist < minDist) {
      nearTop = e;
      return (minDist = dist);
    }
  });
  return nearTop;
}

function scrollAfter(x) {
  const nearTop = closestToTop();
  const offset = nearTop?.getBoundingClientRect().top;
  x();
  if (nearTop != null) {
    Tracker.afterFlush(() =>
      $(`#${nearTop.id}`).get(0).scrollIntoView({
        behavior: "smooth",
      })
    );
  }
}

// Router
const BlackboardRouter = Backbone.Router.extend({
  routes: {
    "": "BlackboardPage",
    graph: "GraphPage",
    map: "MapPage",
    edit: "EditPage",
    "rounds/:round": "RoundPage",
    "puzzles/:puzzle": "PuzzlePage",
    "puzzles/:puzzle/:view": "PuzzlePage",
    "chat/:type/:id": "ChatPage",
    oplogs: "OpLogPage",
    facts: "FactsPage",
    statistics: "StatisticsPage",
    logistics: "LogisticsPage",
    callins: "LogisticsRedirect",
    projector: "ProjectorPage",
  },

  BlackboardPage() {
    scrollAfter(() => {
      this.Page("blackboard", "general", "0", true, true);
      Session.set({
        color: "inherit",
        canEdit: undefined,
        topRight: "blackboard_status_grid",
      });
    });
  },

  EditPage() {
    scrollAfter(() => {
      this.Page("blackboard", "general", "0", true, true);
      Session.set({
        color: "inherit",
        canEdit: true,
        topRight: "blackboard_status_grid",
      });
    });
  },

  GraphPage() {
    this.Page("graph", "general", "0", false);
  },

  MapPage() {
    this.Page("map", "general", "0", false);
  },

  async LogisticsPage() {
    this.Page("logistics_page", "general", "0", true, true);
    await awaitBundleLoaded();
  },

  LogisticsRedirect() {
    this.navigate("/logistics", { trigger: true, replace: true });
  },

  ProjectorPage() {
    this.Page("projector", "general", "0", false);
  },

  PuzzlePage(id, view = null) {
    this.Page("puzzle", "puzzles", id, true, true);
    Session.set({
      timestamp: 0,
      view,
    });
  },

  RoundPage(id) {
    this.goToChat("rounds", id, 0);
  },

  ChatPage(type, id) {
    if (type === "general") {
      id = "0";
    }
    this.Page("chat", type, id, true);
  },

  OpLogPage() {
    this.Page("oplog", "oplog", "0", false);
  },

  FactsPage() {
    this.Page("facts", "facts", "0", false);
  },

  StatisticsPage() {
    this.Page("statistics", "general", "0", false);
  },

  Page(page, type, id, has_chat, splitter) {
    const old_room = Session.get("room_name");
    const new_room = has_chat ? `${type}/${id}` : null;
    if (old_room !== new_room) {
      // if switching between a puzzle room and full-screen chat, don't reset limit.
      Session.set({
        room_name: new_room,
        limit: INITIAL_CHAT_LIMIT,
      });
    }
    Session.set({
      splitter: splitter ?? false,
      currentPage: page,
      type,
      id,
    });
    // cancel modals if they were active
    $(".modal").modal("hide");
  },

  urlFor(type, id) {
    return Meteor._relativeToSiteRootUrl(`/${type}/${id}`);
  },
  chatUrlFor(type, id) {
    return Meteor._relativeToSiteRootUrl(`/chat${this.urlFor(type, id)}`);
  },

  goTo(type, id) {
    this.navigate(this.urlFor(type, id), { trigger: true });
  },

  goToRound(round) {
    this.goTo("rounds", round._id);
  },

  goToPuzzle(puzzle) {
    this.goTo("puzzles", puzzle._id);
  },

  goToChat(type, id) {
    this.navigate(this.chatUrlFor(type, id), { trigger: true });
  },
});

export default new BlackboardRouter();
