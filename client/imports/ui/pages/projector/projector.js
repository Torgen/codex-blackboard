import "./projector.html";

const VIEWS = ["chart", "map", "graph"];
Object.freeze(VIEWS);

Template.projector.onCreated(async function () {
  this.loaded = new ReactiveVar(false);
  this.previousView = new ReactiveVar(null);
  this.currentViewIndex = new ReactiveVar(0);
  await Promise.all([
    import("./projector.less"),
    import("../map/map.js"),
    import("../graph/graph.js"),
    import("../statistics/statistics_chart.js")
  ]);
  this.loaded.set(true);
  this.tenSeconds = Meteor.setInterval(() => {
    const index = this.currentViewIndex.get();
    this.previousView.set(VIEWS[index]);
    this.currentViewIndex.set((index + 1) % VIEWS.length);
  }, 10000);
});

Template.projector.onRendered(function () {
  this.autorun(() => {
    if (!this.loaded.get()) {
      return;
    }
    this.$("#projector_page").trigger(new $.Event("loaded"));
  });
});

Template.projector.helpers({
  loaded() {
    return Template.instance().loaded.get();
  },
  classForView(viewName) {
    if (Template.instance().previousView.get() === viewName) {
      return "projector-previous-view";
    }
    if (VIEWS[Template.instance().currentViewIndex.get()] === viewName) {
      return "projector-current-view";
    }
    return "projector-hidden-view";
  }
});

Template.projector.onDestroyed(function () {
  Meteor.clearInterval(this.tenSeconds);
});
