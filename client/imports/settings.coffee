'use strict'
import { reactiveLocalStorage } from './storage.coffee'

class Setting
  constructor: (@name, helper) ->
    helper = @name unless helper?
    Template.registerHelper helper, => @get()

  set: (value) -> reactiveLocalStorage.setItem @name, value

class DefaultFalseSetting extends Setting
  get: -> 'true' is reactiveLocalStorage.getItem @name

export CAP_JITSI_HEIGHT = new DefaultFalseSetting 'capJitsiHeight', 'jitsiHeightCapped'
export HIDE_SOLVED = new DefaultFalseSetting 'hideSolved'
export HIDE_SOLVED_FAVES = new DefaultFalseSetting 'hideSolvedFaves'
export HIDE_SOLVED_METAS = new DefaultFalseSetting 'hideSolvedMeta'
export STUCK_TO_TOP = new DefaultFalseSetting 'stuckToTop'
export HIDE_USELESS_BOT_MESSAGES = new DefaultFalseSetting 'nobot', 'noBot'
export MUTE_SOUND_EFFECTS = new DefaultFalseSetting 'mute', 'sfxMute'
export HIDE_OLD_PRESENCE = new DefaultFalseSetting 'hideOldPresence'
export LESS_COLORFUL = new DefaultFalseSetting 'boringMode'
export SORT_REVERSE = new DefaultFalseSetting 'sortReverse'

class DefaultTrueSetting extends Setting
  get: -> 'false' isnt reactiveLocalStorage.getItem @name

export START_VIDEO_MUTED = new DefaultTrueSetting 'startVideoMuted'
export START_AUDIO_MUTED = new DefaultTrueSetting 'startAudioMuted'

darkModeDefault = do ->
  darkModeQuery = window.matchMedia '(prefers-color-scheme: dark)'
  res = new ReactiveVar darkModeQuery.matches
  darkModeQuery.addEventListener 'change', (e) ->
    res.set e.matches
  res

class DarkModeSetting extends Setting
  get: ->
    darkModeOverride = reactiveLocalStorage.getItem @name
    if darkModeOverride?
      return darkModeOverride is 'true'
    darkModeDefault.get()

export DARK_MODE = new DarkModeSetting 'darkMode'

class CompactModeSetting extends Setting
  get: ->
    editing = Meteor.userId() and Session.get 'canEdit'
    ('true' is reactiveLocalStorage.getItem @name) and not editing

export COMPACT_MODE = new CompactModeSetting 'compactMode'
