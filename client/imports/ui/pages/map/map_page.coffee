import './map_page.html'

Template.map_page.onCreated ->
  @followTheSun = new ReactiveVar false
  @loaded = new ReactiveVar false
  await import('./map.coffee')
  @loaded.set true

Template.map_page.helpers
  loaded: -> Template.instance().loaded.get()
  followTheSun: -> Template.instance().followTheSun.get()

Template.map_page.events
  'click .bb-follow-the-sun.active': (e, t) -> t.followTheSun.set false
  'click .bb-follow-the-sun:not(.active)': (e, t) -> t.followTheSun.set true
