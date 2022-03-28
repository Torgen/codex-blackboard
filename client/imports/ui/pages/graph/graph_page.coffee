'use strict'

import './graph_page.html'

Template.graph_page.onCreated ->
  @loaded = new ReactiveVar false
  await import('./graph.coffee')
  @loaded.set true

Template.graph_page.events
  'click .bb-layout': (event, template) ->
    graphs = template.$('.bb-status-graph')
    console.log graphs.get()
    graphs.trigger('bb-layout')
  
Template.graph_page.helpers
  loaded: -> Template.instance().loaded.get()
