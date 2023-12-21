import "./graph_page.html";
import "/client/imports/ui/components/connection_button/connection_button.js";

Template.graph_page.onCreated(async function () {
  this.loaded = new ReactiveVar(false);
  await import("./graph.js");
  this.loaded.set(true);
});

Template.graph_page.events({
  "click .bb-layout"(event, template) {
    template.$(".bb-status-graph").trigger("bb-layout");
  }
});

Template.graph_page.helpers({
  loaded() {
    return Template.instance().loaded.get();
  }
});
