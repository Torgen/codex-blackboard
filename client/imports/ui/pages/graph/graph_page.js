// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './graph_page.html';

Template.graph_page.onCreated(async function() {
  this.loaded = new ReactiveVar(false);
  await import('./graph.js');
  return this.loaded.set(true);
});

Template.graph_page.events({
  'click .bb-layout'(event, template) {
    return template.$('.bb-status-graph').trigger('bb-layout');
  }
});

Template.graph_page.helpers({
  loaded() { return Template.instance().loaded.get(); }});
