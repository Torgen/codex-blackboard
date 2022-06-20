'use strict'
import './logistics_page.html'
import { EXPERT_MODE } from '/client/imports/settings.coffee'

bundleLoaded = new ReactiveVar false

Template.logistics_page.onCreated ->
  EXPERT_MODE.set true
  await import('/client/imports/ui/pages/logistics/logistics.coffee')
  bundleLoaded.set true

Template.logistics_page.helpers
  bundleLoaded: -> bundleLoaded.get()
