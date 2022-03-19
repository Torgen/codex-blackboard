'use strict'
import './logistics_page.html'

bundleLoaded = new ReactiveVar false

Template.logistics_page.onCreated ->
  await import('/client/imports/ui/pages/logistics/logistics.coffee')
  bundleLoaded.set true

Template.logistics_page.helpers
  bundleLoaded: -> bundleLoaded.get()
