import { INITIAL_CHAT_LIMIT } from "/client/imports/server_settings.js";
import { awaitBundleLoaded } from "/client/imports/ui/pages/logistics/logistics_page.js";
import page from "page";

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

page("/", BlackboardPage);
page("/edit", EditPage);
page("/graph", GraphPage);
page("/map", MapPage);
page("/rounds/:round", ({ params: { round } }) => RoundPage(round));
page("/puzzles/:puzzle", ({ params: { puzzle } }) => PuzzlePage(puzzle));
page("/puzzles/:puzzle/:view", ({ params: { puzzle, view } }) =>
  PuzzlePage(puzzle, view)
);
page("/chat/:type/:id", ({ params: { type, id } }) => ChatPage(type, id));
page("/oplogs", OpLogPage);
page("/facts", FactsPage);
page("/statistics", StatisticsPage);
page("/logistics", LogisticsPage);
page.redirect("/callins", "/logistics");
page("/projector", ProjectorPage);

export function BlackboardPage() {
  scrollAfter(() => {
    Page("blackboard", "general", "0", true, true);
    Session.set({
      color: "inherit",
      canEdit: undefined,
      topRight: "blackboard_status_grid",
    });
  });
}

export function EditPage() {
  scrollAfter(() => {
    Page("blackboard", "general", "0", true, true);
    Session.set({
      color: "inherit",
      canEdit: true,
      topRight: "blackboard_status_grid",
    });
  });
}

export function GraphPage() {
  Page("graph", "general", "0", false);
}

export function MapPage() {
  Page("map", "general", "0", false);
}

export async function LogisticsPage() {
  Page("logistics_page", "general", "0", true, true);
  await awaitBundleLoaded();
}

export function ProjectorPage() {
  Page("projector", "general", "0", false);
}

export function PuzzlePage(id, view = null) {
  Page("puzzle", "puzzles", id, true, true);
  Session.set({
    timestamp: 0,
    view,
  });
}

export function RoundPage(id) {
  page.redirect(chatUrlFor("rounds", id));
}

export function ChatPage(type, id) {
  if (type === "general") {
    id = "0";
  }
  Page("chat", type, id, true);
}

export function OpLogPage() {
  Page("oplog", "oplog", "0", false);
}

export function FactsPage() {
  Page("facts", "facts", "0", false);
}

export function StatisticsPage(ctx) {
  const params = new URLSearchParams(ctx.querystring);
  function maybeDate(x) {
    if (x) {
      return new Date(x);
    }
    return null;
  }
  Session.set({
    start_time: maybeDate(params.get("start_time")),
    end_time: maybeDate(params.get("end_time")),
  });
  Page("statistics", "general", "0", false);
}

function Page(page, type, id, has_chat, splitter) {
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
}

export function urlFor(type, id) {
  return Meteor._relativeToSiteRootUrl(`/${type}/${id}`);
}

function chatUrlFor(type, id) {
  return Meteor._relativeToSiteRootUrl(`/chat${urlFor(type, id)}`);
}

export function goToChat(type, id) {
  page(chatUrlFor(type, id));
}

export function navigate(to) {
  if (typeof to !== "string") {
    throw new Error("target of navigate must be string");
  }
  page(to);
}

page.start({ click: false });
