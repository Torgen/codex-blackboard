import "./map_page.html";
import "/client/imports/ui/components/connection_button/connection_button.js";

Template.map_page.onCreated(async function () {
  this.followTheSun = new ReactiveVar(false);
  this.loaded = new ReactiveVar(false);
  await import("./map.js");
  this.loaded.set(true);
});

Template.map_page.helpers({
  loaded() {
    return Template.instance().loaded.get();
  },
  followTheSun() {
    return Template.instance().followTheSun.get();
  },
});

Template.map_page.events({
  "click .bb-follow-the-sun.active"(e, t) {
    t.followTheSun.set(false);
  },
  "click .bb-follow-the-sun:not(.active)"(e, t) {
    t.followTheSun.set(true);
  },
});
