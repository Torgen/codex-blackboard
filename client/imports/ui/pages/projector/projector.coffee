'use strict'

import './projector.html'

VIEWS = ['chart', 'map', 'graph']
Object.freeze(VIEWS)

Template.projector.onCreated ->
  @loaded = new ReactiveVar false
  @previousView = new ReactiveVar null
  @currentViewIndex = new ReactiveVar 0
  await Promise.all [import('./projector.less'), import('../map/map.coffee'), import('../graph/graph.coffee'), import('../statistics/statistics_chart.coffee')]
  @loaded.set true
  @tenSeconds = Meteor.setInterval =>
    index = @currentViewIndex.get()
    @previousView.set VIEWS[index]
    @currentViewIndex.set((index + 1) % VIEWS.length)
  , 10000

Template.projector.onRendered ->
  @autorun =>
    return unless @loaded.get()
    @$('#projector_page').trigger new $.Event 'loaded'

Template.projector.helpers
  loaded: -> Template.instance().loaded.get()
  classForView: (viewName) ->
    return 'projector-previous-view' if Template.instance().previousView.get() is viewName
    return 'projector-current-view' if VIEWS[Template.instance().currentViewIndex.get()] is viewName
    return 'projector-hidden-view'

Template.projector.onDestroyed ->
  Meteor.clearInterval @tenSeconds
