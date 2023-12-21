import "./statistics_page.html";
import "/client/imports/ui/components/connection_button/connection_button.js";

Template.statistics_page.onCreated(async function () {
  this.loaded = new ReactiveVar(false);
  await import("./statistics_chart.js");
  this.loaded.set(true);
});

Template.statistics_page.helpers({
  loaded() {
    return Template.instance().loaded.get();
  }
});
