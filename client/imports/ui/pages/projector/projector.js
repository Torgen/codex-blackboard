// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './projector.html';

const VIEWS = ['chart', 'map', 'graph'];
Object.freeze(VIEWS);

Template.projector.onCreated(async function() {
  this.loaded = new ReactiveVar(false);
  this.previousView = new ReactiveVar(null);
  this.currentViewIndex = new ReactiveVar(0);
  await Promise.all([import('./projector.less'), import('../map/map.coffee'), import('../graph/graph.coffee'), import('../statistics/statistics_chart.coffee')]);
  this.loaded.set(true);
  return this.tenSeconds = Meteor.setInterval(() => {
    const index = this.currentViewIndex.get();
    this.previousView.set(VIEWS[index]);
    return this.currentViewIndex.set((index + 1) % VIEWS.length);
  }
  , 10000);
});

Template.projector.onRendered(function() {
  return this.autorun(() => {
    if (!this.loaded.get()) { return; }
    return this.$('#projector_page').trigger(new $.Event('loaded'));
  });
});

Template.projector.helpers({
  loaded() { return Template.instance().loaded.get(); },
  classForView(viewName) {
    if (Template.instance().previousView.get() === viewName) { return 'projector-previous-view'; }
    if (VIEWS[Template.instance().currentViewIndex.get()] === viewName) { return 'projector-current-view'; }
    return 'projector-hidden-view';
  }
});

Template.projector.onDestroyed(function() {
  return Meteor.clearInterval(this.tenSeconds);
});
