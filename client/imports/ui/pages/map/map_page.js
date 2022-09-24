// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './map_page.html';

Template.map_page.onCreated(async function() {
  this.followTheSun = new ReactiveVar(false);
  this.loaded = new ReactiveVar(false);
  await import('./map.js');
  return this.loaded.set(true);
});

Template.map_page.helpers({
  loaded() { return Template.instance().loaded.get(); },
  followTheSun() { return Template.instance().followTheSun.get(); }
});

Template.map_page.events({
  'click .bb-follow-the-sun.active'(e, t) { return t.followTheSun.set(false); },
  'click .bb-follow-the-sun:not(.active)'(e, t) { return t.followTheSun.set(true); }
});
