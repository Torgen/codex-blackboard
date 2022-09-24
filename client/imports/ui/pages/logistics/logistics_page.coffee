'use strict'
import './logistics_page.html'
import { EXPERT_MODE } from '/client/imports/settings.coffee'

bundleLoaded = new ReactiveVar false

export awaitBundleLoaded = ->
  new Promise (resolve) ->
    Tracker.autorun (computation) ->
      return unless bundleLoaded.get()
      resolve()
      computation.stop()

Template.logistics_page.onCreated ->
  EXPERT_MODE.set true
  # The template we would set the top right to is loaded dynamically, so we
  # want to clear the current setting until the bundle loads. It will set the
  # top right panel to the correct template.
  # This matters mostly in development, but could come up if we update the app
  # during the hunt. Session preserves values across reloads and doesn't
  # trigger if the value doesn't change.
  Session.set 'topRight', null
  await blimport('/client/imports/ui/pages/logistics/logistics.coffee')
  bundleLoaded.set true

Template.logistics_page.helpers
  bundleLoaded: -> bundleLoaded.get()
