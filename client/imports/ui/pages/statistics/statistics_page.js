/*
 * decaffeinate suggestions:
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './statistics_page.html';

Template.statistics_page.onCreated(async function() {
  this.loaded = new ReactiveVar(false);
  await blimport('./statistics_chart.coffee');
  return this.loaded.set(true);
});

Template.statistics_page.helpers({
  loaded() { return Template.instance().loaded.get(); }});
