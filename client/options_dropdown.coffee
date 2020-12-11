'use strict'
import { reactiveLocalStorage } from './imports/storage.coffee'

compactMode = ->
  editing = Meteor.userId() and Session.get 'canEdit'
  ('true' is reactiveLocalStorage.getItem 'compactMode') and not editing

Template.registerHelper 'nCols', ->
  if compactMode()
    2
  else if Meteor.userId() and (Session.get 'canEdit')
    3
  else
    5

Template.registerHelper 'compactMode', compactMode
Template.registerHelper 'hideSolved', -> 'true' is reactiveLocalStorage.getItem 'hideSolved'
Template.registerHelper 'hideSolvedFaves', -> 'true' is reactiveLocalStorage.getItem 'hideSolvedFaves'
Template.registerHelper 'hideSolvedMeta', -> 'true' is reactiveLocalStorage.getItem 'hideSolvedMeta'
Template.registerHelper 'hideStatus', -> 'true' is reactiveLocalStorage.getItem 'hideStatus'
Template.registerHelper 'stuckToTop', -> 'true' is reactiveLocalStorage.getItem 'stuckToTop'
Template.registerHelper 'noBot', -> 'true' is reactiveLocalStorage.getItem 'nobot'
Template.registerHelper 'hideOldPresence', -> 'true' is reactiveLocalStorage.getItem 'hideOldPresence'

Template.options_dropdown.helpers
  jitsi: share.settings.JITSI_SERVER?
  startVideoMuted: -> 'false' isnt reactiveLocalStorage.getItem 'startVideoMuted'
  startAudioMuted: -> 'false' isnt reactiveLocalStorage.getItem 'startAudioMuted'

Template.options_dropdown.events
  'click .bb-display-settings li a': (event, template) ->
    # Stop the dropdown from closing.
    event.stopPropagation()
  'change .bb-hide-solved input': (event, template) ->
    reactiveLocalStorage.setItem 'hideSolved', event.target.checked
  'change .bb-hide-solved-meta input': (event, template) ->
    reactiveLocalStorage.setItem 'hideSolvedMeta', event.target.checked
  'change .bb-hide-solved-faves input': (event, template) ->
    reactiveLocalStorage.setItem 'hideSolvedFaves', event.target.checked
  'change .bb-compact-mode input': (event, template) ->
    reactiveLocalStorage.setItem 'compactMode', event.target.checked
  'change .bb-boring-mode input': (event, template) ->
    reactiveLocalStorage.setItem 'boringMode', event.target.checked
  'change .bb-stuck-to-top input': (event, template) ->
    reactiveLocalStorage.setItem 'stuckToTop', event.target.checked
  'change .bb-bot-mute input': (event, template) ->
    reactiveLocalStorage.setItem 'nobot', event.target.checked
  'change .bb-hide-old-presence input': (event, template) ->
    reactiveLocalStorage.setItem 'hideOldPresence', event.target.checked
  'change .bb-start-video-muted input': (event, template) ->
    reactiveLocalStorage.setItem 'startVideoMuted', event.target.checked
  'change .bb-start-audio-muted input': (event, template) ->
    reactiveLocalStorage.setItem 'startAudioMuted', event.target.checked
