'use strict'

import canonical from './canonical.coffee'
import { NonEmptyString } from './match.coffee'
import { URL } from 'meteor/url'

# Global dynamic settings
#  _id: canonical form of name
#  value: Current value of the setting
#  touched: when the setting was changed
#  touched_by: who last changed the setting
export Settings = new Mongo.Collection 'settings'

export all_settings = {}

class Setting
  constructor: (@name, @description, @default, @matcher, @parser) ->
    @canon = canonical @name
    all_settings[@canon] = @
    @ensure() if Meteor.isServer
    Object.freeze @

  # Reactive on client side
  get: ->
    try
      return @convert Settings.findOne(@canon)?.value
    catch error
      console.warn "get setting #{@name} failed", error

  # Requires login. On server, from non-method code, use impersonating() to
  # pretend to be a user.
  set: (value) -> Meteor.call 'changeSetting', @canon, value

  # Checks that raw either satisfies the matcher, or is a string that parses to
  # a value that satisfies the matcher.
  # Returns the converted value if so, or raises Match.Error if not.
  convert: (raw) ->
    return raw if Match.test raw, @matcher
    check raw, String
    conv = @parser raw
    check conv, @matcher
    conv

  ensure: ->
    Settings.upsert @canon,
      $setOnInsert:
        value: @convert(@default)
        touched: Date.now()

parse_boolean = (x) ->
  switch x
    when 'true' then true
    when 'false' then false
    else throw new Match.Error "Bad boolean string #{x}"

url_matcher = Match.Where (url) ->
  check url, String
  return true if url.length is 0
  u = null
  try
    u = new URL url
  catch error
    throw new Match.Error "Could not parse #{url} as URL: #{error}"
  unless u.protocol is 'https:' or u.protocol is 'http:'
    throw new Match.Error "Invalid URL protocol #{u.protocol} in URL #{url}"
  true

path_component_matcher = Match.Where (s) ->
  /^[-_a-zA-Z0-9]*$/.test(s)

id = (x) -> x

export EmbedPuzzles = new Setting(
  'Embed Puzzles',
  'Allow embedding iframe of puzzles on puzzle page. Disable if hunt site uses X-Frame-Options to forbid embedding.',
  true,
  Boolean,
  parse_boolean
)

export PuzzleUrlPrefix = new Setting(
  'Puzzle URL Prefix',
  'If set, used as the prefix for new puzzles. Otherwise, they must be set manually',
  '',
  url_matcher,
  id
)

export RoundUrlPrefix = new Setting(
  'Round URL Prefix',
  'If set, used as the prefix for new rounds. Otherwise, they must be set manually',
  '',
  url_matcher,
  id
)

export MaximumMemeLength = new Setting(
  'Maximum Meme Length',
  'The maximum length of a message that can be turned into a meme.',
  140,
  Match.Integer,
  parseInt
)

export StaticJitsiMeeting = new Setting(
  'Static Jitsi Meeting',
  'The name of the jitsi room to use for the blackboard and callins page',
  if Meteor.isServer then (Meteor.settings?.jitsi?.staticRoom ? process.env.STATIC_JITSI_ROOM ? '') else '',
  path_component_matcher,
  canonical
)

Object.freeze all_settings

Meteor.methods
  changeSetting: (setting_name, raw_value) ->
    check @userId, NonEmptyString
    check setting_name, String
    canonical_name = canonical setting_name
    setting = all_settings[canonical_name]
    check setting, Setting
    0 < Settings.update canonical_name, $set:
      value: setting.convert raw_value
      touched: Date.now()
      touched_by: @userId

if Meteor.isClient
  Meteor.subscribe 'settings'
