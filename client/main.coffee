'use strict'

import md5 from 'md5'
import { gravatarUrl, nickHash } from './imports/nickEmail.coffee'
import abbrev from '../lib/imports/abbrev.coffee'
import canonical from '/lib/imports/canonical.coffee'
import { BBCollection, Messages, Names, Puzzles, collection, pretty_collection } from '/lib/imports/collections.coffee'
import { human_readable, abbrev as ctabbrev } from '../lib/imports/callin_types.coffee'
import { mechanics } from '../lib/imports/mechanics.coffee'
import { fileType } from '../lib/imports/mime_type.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import textify from './imports/textify.coffee'
import embeddable from './imports/embeddable.coffee'
import { GENERAL_ROOM_NAME, NAME_PLACEHOLDER, TEAM_NAME } from '/client/imports/server_settings.coffee'
import { DARK_MODE, MUTE_SOUND_EFFECTS } from './imports/settings.coffee'
import * as notification from '/client/imports/notification.coffee'
import Router from '/client/imports/router.coffee'
import '/client/imports/ui/pages/graph/graph_page.coffee'
import '/client/imports/ui/pages/map/map_page.coffee'
import '/client/imports/ui/pages/projector/projector.coffee'
import '/client/imports/ui/pages/statistics/statistics_page.coffee'

# "Top level" templates:
#   "blackboard" -- main blackboard page
#   "puzzle"     -- puzzle information page
#   "round"      -- round information (much like the puzzle page)
#   "chat"       -- chat room
#   "oplogs"     -- operation logs
#   "callins"    -- answer queue
#   "facts"      -- server performance information
Template.registerHelper "equal", (a, b) -> a is b
Template.registerHelper "less", (a, b) -> a < b
Template.registerHelper 'any', (a..., options) ->
  a.some (x) -> x
Template.registerHelper 'includes', (haystack, needle) -> haystack?.includes needle 
Template.registerHelper 'all', (a..., options) ->
  a.every (x) -> x
Template.registerHelper 'not', (a) -> not a
Template.registerHelper 'split', (value, delimiter) -> value.split(delimiter)
Template.registerHelper 'concat', (a..., options) ->
  a.join(options.delimiter ? '')

# session variables we want to make available from all templates
do -> for v in ['currentPage']
  Template.registerHelper v, () -> Session.get(v)
Template.registerHelper 'abbrev', abbrev
Template.registerHelper 'callinType', human_readable
Template.registerHelper 'callinTypeAbbrev', ctabbrev
Template.registerHelper 'canonical', canonical
Template.registerHelper 'currentPageEquals', (arg) ->
  # register a more precise dependency on the value of currentPage
  Session.equals 'currentPage', arg
Template.registerHelper 'typeEquals', (arg) ->
  # register a more precise dependency on the value of type
  Session.equals 'type', arg
Template.registerHelper 'canEdit', () ->
  Meteor.userId() and (Session.get 'canEdit') and \
  (Session.equals 'currentPage', 'blackboard')

Template.registerHelper 'md5', md5
Template.registerHelper 'fileType', fileType

Template.registerHelper 'teamName', -> TEAM_NAME
Template.registerHelper 'generalRoomName', -> GENERAL_ROOM_NAME

Template.registerHelper 'namePlaceholder', -> NAME_PLACEHOLDER

Template.registerHelper 'mynick', -> Meteor.userId()

Template.registerHelper 'embeddable', embeddable

Template.registerHelper 'plural', (x) -> x != 1

Template.registerHelper 'nullToZero', (x) -> x ? 0

Template.registerHelper 'canGoFullScreen', -> $('body').get(0)?.requestFullscreen?

Tracker.autorun ->
  if DARK_MODE.get()
    $('body').addClass 'darkMode'
  else
    $('body').removeClass 'darkMode'

Template.page.helpers
  splitter: -> Session.get 'splitter'
  topRight: -> Session.get 'topRight'
  type: -> Session.get 'type'
  id: -> Session.get 'id'
  color: -> Session.get 'color'

allPuzzlesHandle = Meteor.subscribe 'all-roundsandpuzzles'

debouncedUpdate = ->
  now = new ReactiveVar Date.now()
  update = do ->
    next = now.get()
    push = _.debounce (-> now.set next), 1000
    (newNext) ->
      if newNext > next
        next = newNext
        push()
  {now, update}

Meteor.startup ->
  # Notifications based on oplogs
  {now, update} = debouncedUpdate()
  suppress = true
  Tracker.autorun ->
    if notification.count() is 0
      suppress = true
      return
    else if suppress
      now.set Date.now()
    Meteor.subscribe 'oplogs-since', now.get(),
      onReady: -> suppress = false
  Messages.find({room_name: 'oplog/0', timestamp: $gt: now.get()}).observe
    added: (msg) ->
      update msg.timestamp
      return unless notification.granted()
      return unless notification.get(msg.stream)
      return if suppress
      gravatar = gravatarUrl
        gravatar_md5: nickHash(msg.nick)
        size: 192
      body = msg.body
      if msg.type and msg.id
        body = "#{body} #{pretty_collection(msg.type)}
                #{collection(msg.type).findOne(msg.id)?.name}"
      data = undefined
      if msg.stream is 'callins'
        data = url: '/logistics'
      else
        data = url: Router.urlFor msg.type, msg.id
      # If sounde effects are off, notifications should be silent. If they're not, turn off sound for
      # notifications that already have sound effects.
      silent = MUTE_SOUND_EFFECTS.get() or ['callins', 'answers'].includes msg.stream
      notification.notify msg.nick,
        body: body
        tag: msg._id
        icon: gravatar
        data: data
        silent: silent

Meteor.startup ->
  # Notifications on favrite mechanics
  Tracker.autorun ->
    return unless allPuzzlesHandle?.ready()
    return unless notification.granted()
    return unless notification.get 'favorite-mechanics'
    myFaves = Meteor.user()?.favorite_mechanics
    return unless myFaves
    faveSuppress = true
    myFaves.forEach (mech) ->
      Puzzles.find(mechanics: mech).observeChanges
        added: (id, puzzle) ->
          return if faveSuppress
          notification.notify puzzle.name,
            body: "Mechanic \"#{mechanics[mech].name}\" added to puzzle \"#{puzzle.name}\""
            tag: "#{id}/#{mech}"
            data: url: Router.urlFor 'puzzles', id
            silent: MUTE_SOUND_EFFECTS.get()
    faveSuppress = false

Meteor.startup ->
  # Notifications on private messages and mentions
  Tracker.autorun ->
    return unless allPuzzlesHandle?.ready()
    return unless notification.granted()
    return unless notification.get 'private-messages'
    me = Meteor.user()?._id
    return unless me?
    arnow = Date.now()  # Intentionally not reactive
    Messages.find({$or: [{to: me}, {mention: me}], timestamp: $gt: arnow}).observeChanges
      added: (msgid, message) ->
        [room_name, url] = if message.room_name is 'general/0'
          [GENERAL_ROOM_NAME, Meteor._relativeToSiteRootUrl '/']
        else
          [type, id] = message.room_name.split '/'
          target = Names.findOne id
          if target.type is type
            pretty_type = pretty_collection(type).replace /^[a-z]/, (x) -> x.toUpperCase()
            ["#{pretty_type} \"#{target.name}\"", Router.urlFor type, id]
          else
            [message.room_name, Router.chatUrlFor message.room_name]
        gravatar = gravatarUrl
          gravatar_md5: nickHash(message.nick)
          size: 192
        body = message.body
        if message.bodyIsHtml
          body = textify body
        description = if message.to?
          "Private message from #{message.nick} in #{room_name}"
        else
          "Mentioned by #{message.nick} in #{room_name}"
        notification.notify description,
          body: body
          tag: msgid
          data: {url}
          icon: gravatar
          silent: MUTE_SOUND_EFFECTS.get()

Meteor.startup ->
  # Notifications on announcements
  {now, update} = debouncedUpdate()
  suppress = true
  Tracker.autorun ->
    return unless notification.granted()
    unless notification.get 'announcements'
      suppress = true
      return
    else if suppress
      now.set Date.now()
    Meteor.subscribe 'announcements-since', now.get(),
      onReady: -> suppress = false
    Messages.find({announced_at: $gt: now.get()}).observe
      added: (msg) ->
        update msg.announced_at
        return unless notification.granted()
        return unless notification.get 'announcements'
        return if suppress
        gravatar = gravatarUrl
          gravatar_md5: nickHash(msg.nick)
          size: 192
        body = msg.body
        if msg.type and msg.id
          body = "#{body} #{pretty_collection(msg.type)}
                  #{collection(msg.type).findOne(msg.id)?.name}"
        data = url: Meteor._relativeToSiteRootUrl '/'
        # If sounde effects are off, notifications should be silent. If they're not, turn off sound for
        # notifications that already have sound effects.
        silent = MUTE_SOUND_EFFECTS.get()
        notification.notify "Announcement by #{msg.nick}",
          body: body
          tag: msg._id
          icon: gravatar
          data: data
          silent: silent

Backbone.history.start {pushState: true}

window.collections = BBCollection
