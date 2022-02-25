import './statistics_page.html'

Template.statistics_page.onCreated ->
  @loaded = new ReactiveVar false
  await import('./statistics_chart.coffee')
  @loaded.set true

Template.statistics_page.helpers
  loaded: -> Template.instance().loaded.get()
