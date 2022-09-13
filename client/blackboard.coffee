'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { confirm } from '/client/imports/modal.coffee'
import { findByChannel } from '/client/imports/presence_index.coffee'
import { jitsiUrl } from './imports/jitsi.coffee'
import puzzleColor  from './imports/objectColor.coffee'
import { HIDE_SOLVED, HIDE_SOLVED_FAVES, HIDE_SOLVED_METAS, MUTE_SOUND_EFFECTS, SORT_REVERSE, VISIBLE_COLUMNS } from './imports/settings.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import PuzzleDrag from './imports/puzzle_drag.coffee'
import okCancelEvents from './imports/ok_cancel_events.coffee'
import '/client/imports/ui/components/create_object/create_object.coffee'
import '/client/imports/ui/components/edit_field/edit_field.coffee'
import '/client/imports/ui/components/edit_tag_value/edit_tag_value.coffee'
import '/client/imports/ui/components/edit_object_title/edit_object_title.coffee'
import '/client/imports/ui/components/fix_puzzle_drive/fix_puzzle_drive.coffee'
import '/client/imports/ui/components/onduty/control.coffee'
import '/client/imports/ui/components/tag_table_rows/tag_table_rows.coffee'

model = share.model # import
settings = share.settings # import

SOUND_THRESHOLD_MS = 30*1000 # 30 seconds

blackboard = {} # store page global state

Meteor.startup ->
  if typeof Audio is 'function' # for phantomjs
    blackboard.newAnswerSound = new Audio(Meteor._relativeToSiteRootUrl '/sound/that_was_easy.wav')
  return unless blackboard.newAnswerSound?.play?
  # set up a persistent query so we can play the sound whenever we get a new
  # answer
  # note that this observe 'leaks' -- we're not setting it up/tearing it
  # down with the blackboard page, we're going to play the sound whatever
  # page the user is currently on.  This is "fun".  Trust us...
  Meteor.subscribe 'last-answered-puzzle'
  # ignore added; that's just the startup state.  Watch 'changed'
  model.LastAnswer.find({}).observe
    changed: (doc, oldDoc) ->
      return unless doc.target? # 'no recent puzzle was solved'
      return if doc.target is oldDoc.target # answer changed, not really new
      console.log 'that was easy', doc, oldDoc
      return if MUTE_SOUND_EFFECTS.get()
      try
        await blackboard.newAnswerSound.play()
      catch err
        console.error err.message, err

Meteor.startup ->
  # see if we've got native emoji support, and add the 'has-emojis' class
  # if so; inspired by
  # https://stackoverflow.com/questions/27688046/css-reference-to-phones-emoji-font
  checkEmoji = (char, x, y, fillStyle='#000') ->
    node = document.createElement('canvas')
    ctx = node.getContext('2d')
    ctx.fillStyle = fillStyle
    ctx.textBaseline = 'top'
    ctx.font = '32px Arial'
    ctx.fillText(char, 0, 0)
    return ctx.getImageData(x, y, 1, 1)
  reddot = checkEmoji '\uD83D\uDD34', 16, 16
  dancing = checkEmoji '\uD83D\uDD7A', 12, 16 # unicode 9.0
  if reddot.data[0] > reddot.data[1] and dancing.data[0] + dancing.data[1] + dancing.data[2] > 0
    console.log 'has unicode 9 color emojis'
    document.body.classList.add 'has-emojis'

######### general properties of the blackboard page ###########

setCompare = (was, will) ->
  return true if not was? and not will?
  return false if not was? or not will?
  was.size is will.size and [...was].every((v) -> will.has v)

Template.blackboard.onCreated ->
  @typeahead = (query,process) ->
    result = new Set
    for n from Meteor.users.find(bot_wakeup: $exists: false)
      result.add n.nickname
      result.add n.real_name if n.real_name?
    [...result]
  @addRound = new ReactiveVar false
  @userSearch = new ReactiveVar null
  @foundAccounts = new ReactiveVar null, setCompare
  @foundPuzzles = new ReactiveVar null, setCompare
  @autorun =>
    userSearch = @userSearch.get()
    if not userSearch?
      @foundAccounts.set null
      return
    c = Meteor.users.find
      $or: [
        { nickname: { $regex: ".*#{userSearch}.*"}},
        { real_name: { $regex: ".*#{userSearch}.*"}},
      ]
    , fields: { _id: 1 }
    @foundAccounts.set new Set(c.map (v) -> v._id)
  @autorun =>
    foundAccounts = @foundAccounts.get()
    if not foundAccounts?
      @foundPuzzles.set null
      return
    p = model.Presence.find
      nick: $in: [...foundAccounts]
      scope: $in: ['chat', 'jitsi']
    res = new Set
    p.forEach (pres) ->
      match = pres.room_name.match /puzzles\/(.*)/
      return unless match?
      res.add match[1]
    @foundPuzzles.set res
  @autorun =>
    @subscribe 'solved-puzzle-time'

Template.blackboard.onRendered ->
  $('input.bb-filter-by-user').typeahead
    source: @typeahead
    updater: (item) =>
      @userSearch.set item
      return item

Template.blackboard.helpers
  whoseGitHub: -> settings.WHOSE_GITHUB
  filter: -> Template.instance().userSearch.get()?
  searchResults: ->
    model.Puzzles.findOne(_id: id) for id from Template.instance().foundPuzzles.get() ? []

Template.blackboard.events
  'click .puzzle-working .button-group:not(.open) .bb-show-filter-by-user': (event, template) ->
    Meteor.defer -> template.find('.bb-filter-by-user').focus()
  'click .puzzle-working .dropdown-menu': (event, template) ->
    event.stopPropagation()
  'keyup .bb-filter-by-user': (event, template) ->
    return unless event.keyCode is 13
    template.userSearch.set (event.target.value or null)
  'click .bb-clear-filter-by-user': (event, template) ->
    template.userSearch.set null

# Notifications
notificationStreams = [
  {name: 'new-puzzles', label: 'New Puzzles'}
  {name: 'announcements', label: 'Announcements'}
  {name: 'callins', label: "Call-Ins"}
  {name: 'answers', label: "Answers"}
  {name: 'stuck', label: 'Stuck Puzzles'}
  {name: 'favorite-mechanics', label: 'Favorite Mechanics'}
  {name: 'private-messages', label: 'Private Messages/Mentions'}
]

Template.blackboard.helpers
  notificationStreams: notificationStreams
  notificationsAsk: ->
    return false unless Notification?
    p = Session.get 'notifications'
    p isnt 'granted' and p isnt 'denied'
  notificationsEnabled: -> Session.equals 'notifications', 'granted'
  anyNotificationsEnabled: -> (share.notification.count() > 0)
  notificationStreamEnabled: (stream) -> share.notification.get stream
Template.blackboard.events
  "click .bb-notification-ask": (event, template) ->
    share.notification.ask()
  "click .bb-notification-enabled": (event, template) ->
    if share.notification.count() > 0
      for item in notificationStreams
        share.notification.set(item.name, false)
    else
      for item in notificationStreams
        share.notification.set(item.name) # default value
  "click .bb-notification-controls.dropdown-menu a": (event, template) ->
    $inp = $( event.currentTarget ).find( 'input' )
    stream = $inp.attr('data-notification-stream')
    share.notification.set(stream, !share.notification.get(stream))
    $( event.target ).blur()
    return false
  "change .bb-notification-controls [data-notification-stream]": (event, template) ->
    share.notification.set event.target.dataset.notificationStream, event.target.checked

round_helper = ->
  dir = if SORT_REVERSE.get() then 'desc' else 'asc'
  model.Rounds.find {}, sort: [["sort_key", dir]]
meta_helper = ->
  # the following is a map() instead of a direct find() to preserve order
  r = for id, index in this.puzzles
    puzzle = model.Puzzles.findOne({_id: id, puzzles: {$ne: null}})
    continue unless puzzle?
    {
      _id: id
      parent: @_id
      puzzle: puzzle
      num_puzzles: puzzle.puzzles.length
    }
  return r
unassigned_helper = ->
  p = for id, index in this.puzzles
    puzzle = model.Puzzles.findOne({_id: id, feedsInto: {$size: 0}, puzzles: {$exists: false}})
    continue unless puzzle?
    { _id: id, parent: @_id, puzzle: puzzle }
  editing = Meteor.userId() and (Session.get 'canEdit')
  return p if editing or !HIDE_SOLVED.get()
  p.filter (pp) -> !pp.puzzle.solved?

############## groups, rounds, and puzzles ####################
Template.blackboard.helpers
  rounds: round_helper
  metas: meta_helper
  unassigned: unassigned_helper
  add_round: -> Template.instance().addRound.get()
  favorites: ->
    query = $or: [
      {"favorites.#{Meteor.userId()}": true},
      mechanics: $in: Meteor.user().favorite_mechanics or []
    ]
    if not Session.get('canEdit') and (HIDE_SOLVED.get() or HIDE_SOLVED_FAVES.get())
      query.solved = $eq: null
    model.Puzzles.find query
  stuckPuzzles: -> model.Puzzles.find
    'tags.status.value': /^stuck/i
  hasJitsiLocalStorage: ->
    reactiveLocalStorage.getItem 'jitsiLocalStorage'
  driveFolder: -> Session.get 'RINGHUNTERS_FOLDER'
  addingRound: ->
    instance = Template.instance()
    return done: ->
      wasAdding = instance.addRound.get()
      instance.addRound.set false
      return wasAdding

Template.blackboard_status_grid.helpers
  rounds: -> model.Rounds.find {}, sort: [["sort_key", 'asc']]
  metas: meta_helper
  color: -> puzzleColor @puzzle if @puzzle?
  unassigned: -> 
    for id, index in this.puzzles
      puzzle = model.Puzzles.findOne({_id: id, feedsInto: {$size: 0}, puzzles: {$exists: false}})
      continue unless puzzle?
      puzzle._id
  puzzles: (ps) ->
    p = ({
      _id: id
      puzzle_num: 1 + index
      puzzle: model.Puzzles.findOne(id) or { _id: id }
    } for id, index in ps)
    return p
  numSolved: (l) -> l.filter((p) -> p.puzzle.solved).length
  stuck: share.model.isStuck

Template.blackboard.onRendered ->
  @escListener = (event) =>
    return unless event.key.startsWith 'Esc'
    @$('.bb-menu-drawer').modal 'hide'
  @$('.bb-menu-drawer').on 'show', => document.addEventListener 'keydown', @escListener
  @$('.bb-menu-drawer').on 'hide', => document.removeEventListener 'keydown', @escListener
    

Template.blackboard.onDestroyed ->
  @$('.bb-menu-drawer').off 'show'
  @$('.bb-menu-drawer').off 'hide'
  document.removeEventListener 'keydown', @escListener

Template.blackboard.events
  "click .bb-menu-button .btn": (event, template) ->
    template.$('.bb-menu-drawer').modal 'show'
  'click .bb-menu-drawer a.bb-clear-jitsi-storage': (event, template) ->
    reactiveLocalStorage.removeItem 'jitsiLocalStorage'
  'click .bb-menu-drawer a': (event, template) ->
    template.$('.bb-menu-drawer').modal 'hide'
    href = event.target.getAttribute 'href'
    if href.match /^#/
      event.preventDefault()
      $(href).get(0)?.scrollIntoView block: 'center', behavior: 'smooth'

Template.blackboard.onRendered ->
  #  page title
  $("title").text("#{settings.TEAM_NAME} Puzzle Blackboard")
  $('#bb-tables .bb-puzzle .puzzle-name > a').tooltip placement: 'left'

Template.blackboard.events
  "click .bb-sort-order button": (event, template) ->
    reverse = $(event.currentTarget).attr('data-sortReverse') is 'true'
    SORT_REVERSE.set reverse
  "click .bb-add-round": (event, template) -> template.addRound.set true
  'click .bb-canEdit .bb-fix-drive': (event, template) ->
    event.stopPropagation() # keep .bb-editable from being processed!
    Meteor.call 'fixPuzzleFolder',
      object: @puzzle._id
      name: @puzzle.name

Template.blackboard_favorite_puzzle.onCreated ->
  @autorun =>
    return unless VISIBLE_COLUMNS.get().includes('update')
    @subscribe 'last-puzzle-room-message', Template.currentData()._id

Template.blackboard_round.onCreated ->
  @addingTag = new ReactiveVar false
  @addingUnassigned = new ReactiveVar false
  @addingMeta = new ReactiveVar false

Template.blackboard_round.helpers
  # the following is a map() instead of a direct find() to preserve order
  metas: ->
    r = for id, index in @puzzles
      puzzle = model.Puzzles.findOne({_id: id, puzzles: {$ne: null}})
      continue unless puzzle?
      {
        _id: id
        puzzle: puzzle
        num_puzzles: puzzle.puzzles.length
        num_solved: model.Puzzles.find({_id: {$in: puzzle.puzzles}, solved: {$ne: null}}).length
      }
    r.reverse() if SORT_REVERSE.get()
    return r
  collapsed: -> 'true' is reactiveLocalStorage.getItem "collapsed_round.#{@_id}"
  unassigned: unassigned_helper
  showRound: ->
    return true if 'true' is Session.get 'canEdit'
    return true unless HIDE_SOLVED_METAS.get()
    for id, index in @puzzles
      puzzle = model.Puzzles.findOne({_id: id, solved: {$eq: null}, $or: [{feedsInto: {$size: 0}}, {puzzles: {$ne: null}}]})
      return true if puzzle?
    return false
  addingTag: ->
    instance = Template.instance()
    {
      adding: -> instance.addingTag.get()
      done: -> instance.addingTag.set false
    }
  addingUnassigned: -> Template.instance().addingUnassigned.get()
  addingUnassignedParams: ->
    instance = Template.instance()
    return
      done: ->
        wasAdding = instance.addingUnassigned.get()
        instance.addingUnassigned.set false
        return wasAdding
      params:
        round: @_id
  addingMeta: -> Template.instance().addingMeta.get()
  addingMetaParams: ->
    instance = Template.instance()
    return
      done: ->
        wasAdding = instance.addingMeta.get()
        instance.addingMeta.set false
        return wasAdding
      params:
        round: @_id
        puzzles: []

moveBeforePrevious = (match, rel, event, template) ->
  row = template.$(event.target).closest(match)
  prevRow = row.prev(match)
  return unless prevRow.length is 1
  args = {}
  args[rel] = prevRow[0].dataset.puzzleId
  Meteor.call 'moveWithinRound', row[0]?.dataset.puzzleId, Template.parentData()._id, args

moveAfterNext = (match, rel, event, template) ->
  row = template.$(event.target).closest(match)
  nextRow = row.next(match)
  return unless nextRow.length is 1
  args = {}
  args[rel] = nextRow[0].dataset.puzzleId
  Meteor.call 'moveWithinRound', row[0]?.dataset.puzzleId, Template.parentData()._id, args

Template.blackboard_round.events
  'click .bb-round-buttons .bb-add-tag': (event, template) ->
    template.addingTag.set true
  'click .bb-round-buttons .bb-move-down': (event, template) ->
    dir = if SORT_REVERSE.get() then -1 else 1
    Meteor.call 'moveRound', template.data._id, dir
  'click .bb-round-buttons .bb-move-up': (event, template) ->
    dir = if SORT_REVERSE.get() then 1 else -1
    Meteor.call 'moveRound', template.data._id, dir
  'click .bb-round-header.collapsed .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_round.#{template.data._id}", false
  'click .bb-round-header:not(.collapsed) .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_round.#{template.data._id}", true
  'click .bb-round-header .bb-delete-icon': (event, template) ->
    event.stopPropagation()
    if (await confirm
      ok_button: 'Yes, delete it'
      no_button: 'No, cancel'
      message: "Are you sure you want to delete the round \"#{template.data.name}\"?"
    )
      Meteor.call 'deleteRound', template.data._id
  
  'click .bb-round-buttons .bb-add-puzzle': (event, template) -> template.addingUnassigned.set true
  'click .bb-round-buttons .bb-add-meta:not(.active)': (event, template) -> template.addingMeta.set true
  'click tbody.unassigned tr.puzzle .bb-move-up': moveBeforePrevious.bind null, 'tr.puzzle', 'before'
  'click tbody.unassigned tr.puzzle .bb-move-down': moveAfterNext.bind null, 'tr.puzzle', 'after'

Template.blackboard_meta.onCreated ->
  @adding = new ReactiveVar false

moveWithinMeta = (pos) -> (event, template) -> 
  meta = template.data
  Meteor.call 'moveWithinMeta', @puzzle._id, meta.puzzle._id, pos: pos

Template.blackboard_meta.events
  'click tbody.meta tr.puzzle .bb-move-up': moveWithinMeta -1
  'click tbody.meta tr.puzzle .bb-move-down': moveWithinMeta 1
  'click tbody.meta tr.meta .bb-move-up': (event, template) ->
    rel = 'before'
    if SORT_REVERSE.get()
      rel = 'after'
    moveBeforePrevious 'tbody.meta', rel, event, template
  'click tbody.meta tr.meta .bb-move-down': (event, template) ->
    rel = 'after'
    if SORT_REVERSE.get()
      rel = 'before'
    moveAfterNext 'tbody.meta', rel, event, template
  'click .bb-meta-buttons .bb-add-puzzle:not(.active)': (event, template) ->
    template.adding.set true
  'click tr.meta.collapsed .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_meta.#{template.data.puzzle._id}", false
  'click tr.meta:not(.collapsed) .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_meta.#{template.data.puzzle._id}", true

Template.blackboard_meta.helpers
  color: -> puzzleColor @puzzle if @puzzle?
  showMeta: -> !HIDE_SOLVED_METAS.get() or (!this.puzzle?.solved?)
  puzzles: ->
    puzzle = model.Puzzles.findOne({_id: @_id}, {fields: {order_by: 1, puzzles: 1}})
    if puzzle?.order_by
      filter =
        feedsInto: @_id
      if not (Session.get 'canEdit') and HIDE_SOLVED.get()
        filter.solved = $eq: null
      return model.Puzzles.find filter,
        sort: {"#{puzzle.order_by}": 1}
        transform: (p) -> {_id: p._id, puzzle: p}
    p = ({
      _id: id
      puzzle: model.Puzzles.findOne(id) or { _id: id }
    } for id, index in puzzle?.puzzles or [])
    editing = Meteor.userId() and (Session.get 'canEdit')
    return p if editing or !HIDE_SOLVED.get()
    p.filter (pp) -> !pp.puzzle.solved?
  stuck: share.model.isStuck
  numHidden: ->
    return 0 unless HIDE_SOLVED.get()
    y = for id, index in @puzzle.puzzles
      x = model.Puzzles.findOne id
      continue unless x?.solved?
    y.length
  collapsed: -> 'true' is reactiveLocalStorage.getItem "collapsed_meta.#{@puzzle._id}"
  adding: -> Template.instance().adding.get()
  addingPuzzle: ->
    instance = Template.instance()
    parentData = Template.parentData()
    return
      done: ->
        wasAdding = instance.adding.get()
        instance.adding.set false
        return wasAdding
      params:
        round: parentData._id
        feedsInto: [@puzzle._id]

Template.blackboard_puzzle_cells.events
  'click .bb-puzzle-add-move .bb-add-tag': (event, template) ->
    template.addingTag.set true
  'change .bb-set-is-meta': (event, template) ->
    if event.target.checked
      Meteor.call 'makeMeta', template.data.puzzle._id
    else
      Meteor.call 'makeNotMeta', template.data.puzzle._id
  'click .bb-feed-meta a[data-puzzle-id]': (event, template) ->
    Meteor.call 'feedMeta', template.data.puzzle._id, event.target.dataset.puzzleId
    event.preventDefault()
  'click button[data-sort-order]': (event, template) ->
    Meteor.call 'setField',
      type: 'puzzles'
      object: template.data.puzzle._id
      fields: order_by: event.currentTarget.dataset.sortOrder
  'click .bb-puzzle-title .bb-delete-icon': (event, template) ->
    event.stopPropagation()
    if (await confirm
      ok_button: 'Yes, delete it'
      no_button: 'No, cancel'
      message: "Are you sure you want to delete the puzzle \"#{template.data.puzzle.name}\"?"
    )
      Meteor.call 'deletePuzzle', template.data.puzzle._id

Template.blackboard_puzzle_cells.onCreated ->
  @addingTag = new ReactiveVar false

Template.blackboard_puzzle_cells.helpers
  allMetas: ->
    return [] unless @
    (model.Puzzles.findOne x) for x in @feedsInto
  otherMetas: ->
    parent = Template.parentData(2)
    return unless parent.puzzle
    return unless @feedsInto?
    return if @feedsInto.length < 2
    return model.Puzzles.find(_id: { $in: @feedsInto, $ne: parent.puzzle._id })
  isMeta: -> return @puzzles?
  canChangeMeta: -> not @puzzles or @puzzles.length is 0
  unfedMetas: ->
    return model.Puzzles.find(puzzles: {$exists: true, $ne: @_id})
  jitsiLink: ->
    return jitsiUrl "puzzles", @puzzle?._id
  addingTag: ->
    instance = Template.instance()
    {
      adding: -> instance.addingTag.get()
      done: -> instance.addingTag.set false
    }

Template.blackboard_column_body_answer.helpers
  answer: -> (model.getTag @puzzle, 'answer') or ''

Template.blackboard_column_body_status.helpers
  status: -> (model.getTag @puzzle, 'status') or ''
  set_by: -> @puzzle?.tags?.status?.touched_by

Template.blackboard_column_body_update.helpers
  stuck: share.model.isStuck
  solverMinutes: ->
    return unless @puzzle.solverTime?
    Math.floor(@puzzle.solverTime / 60000)
  new_message: ->
    not @puzzle.last_read_timestamp? or @puzzle.last_read_timestamp < @puzzle.last_message_timestamp

Template.blackboard_column_body_working.helpers
  whos_working: ->
    return [] unless @puzzle?
    return findByChannel "puzzles/#{@puzzle._id}", {}, sort: {jitsi: -1, joined_timestamp: 1}

colorHelper = -> model.getTag @, 'color'

Template.blackboard_othermeta_link.helpers color: colorHelper
Template.blackboard_addmeta_entry.helpers color: colorHelper

Template.blackboard_unfeed_meta.events
  'click .bb-unfeed-icon': (event, template) ->
    Meteor.call 'unfeedMeta', template.data.puzzle._id, template.data.meta._id

dragdata = null

Template.blackboard_puzzle.helpers
  stuck: share.model.isStuck

Template.blackboard_puzzle.events
  'dragend tr.puzzle': (event, template) ->
    dragdata = null
  'dragstart tr.puzzle': (event, template) ->
    return unless Session.get 'canEdit'
    event = event.originalEvent
    dragdata = new PuzzleDrag @puzzle, Template.parentData(1).puzzle, Template.parentData(2), event.target, event.clientY, event.dataTransfer
  'dragover tr.puzzle': (event, template) ->
    return unless Session.get 'canEdit'
    event = event.originalEvent
    if dragdata?.dragover template.data.puzzle, Template.parentData(1).puzzle, Template.parentData(2), event.target, event.clientY, event.dataTransfer
      event.preventDefault()

Template.blackboard_column_header_working.onCreated ->
  @autorun =>
    @subscribe 'all-presence'

# Update 'currentTime' every minute or so to allow pretty_ts to magically
# update
Meteor.startup ->
  Session.set "currentTime", Date.now() 
  Meteor.setInterval ->
    Session.set "currentTime", Date.now()
  , 60*1000
