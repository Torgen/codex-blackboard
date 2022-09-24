'use strict'

import './graph_page.html'

Template.graph_page.onCreated ->
  @loaded = new ReactiveVar false
  await blimport('./graph.coffee')
  @loaded.set true

Template.graph_page.events
  'click .bb-layout': (event, template) ->
    template.$('.bb-status-graph').trigger('bb-layout')
  
Template.graph_page.helpers
  loaded: -> Template.instance().loaded.get()
