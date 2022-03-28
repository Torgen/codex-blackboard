'use strict'

import './projector.html'

views = ['chart', 'map', 'graph']

Template.projector.onCreated ->
  @loaded = new ReactiveVar false
  @previousView = new ReactiveVar null
  @currentViewIndex = new ReactiveVar 0
  await Promise.all [import('./projector.less'), import('../map/map.coffee'), import('../graph/graph.coffee'), import('../statistics/statistics_chart.coffee')]
  @loaded.set true
  @tenSeconds = Meteor.setInterval =>
    index = @currentViewIndex.get()
    @previousView.set views[index]
    @currentViewIndex.set((index + 1) % views.length)
  , 10000

Template.projector.helpers
  loaded: -> Template.instance().loaded.get()
  classForView: (viewName) ->
    return 'projector-previous-view' if Template.instance().previousView.get() is viewName
    return 'projector-current-view' if views[Template.instance().currentViewIndex.get()] is viewName
    return 'projector-hidden-view'

Template.projector.onDestroyed ->
  Meteor.clearInterval @tenSeconds
