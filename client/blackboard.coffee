'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { confirm } from '/client/imports/modal.coffee'
import { jitsiUrl } from './imports/jitsi.coffee'
import puzzleColor  from './imports/objectColor.coffee'
import { HIDE_SOLVED, HIDE_SOLVED_FAVES, HIDE_SOLVED_METAS, MUTE_SOUND_EFFECTS, SORT_REVERSE, VISIBLE_COLUMNS } from './imports/settings.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import PuzzleDrag from './imports/puzzle_drag.coffee'
import okCancelEvents from './imports/ok_cancel_events.coffee'
import '/client/imports/ui/components/edit_field/edit_field.coffee'
import '/client/imports/ui/components/edit_tag_name/edit_tag_name.coffee'
import '/client/imports/ui/components/edit_tag_value/edit_tag_value.coffee'
import '/client/imports/ui/components/edit_object_title/edit_object_title.coffee'

model = share.model # import
settings = share.settings # import

SOUND_THRESHOLD_MS = 30*1000 # 30 seconds

blackboard = {} # store page global state

presenceIndex = new Map

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
  @typeahead = (query,process) =>
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
  reverse_rounds: -> SORT_REVERSE.get()
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
  "click .bb-round-buttons .bb-add-puzzle": (event, template) ->
    alertify.prompt "Name of new puzzle:", (e,str) =>
      return unless e # bail if cancelled
      Meteor.call 'newPuzzle', { name: str, round: @_id }, (error,r)->
        throw error if error
  "click .bb-round-buttons .bb-add-meta": (event, template) ->
    alertify.prompt "Name of new metapuzzle:", (e,str) =>
      return unless e # bail if cancelled
      Meteor.call 'newPuzzle', { name: str, round: @_id, puzzles: [] }, (error,r)->
        throw error if error
  'click .bb-canEdit .bb-fix-drive': (event, template) ->
    event.stopPropagation() # keep .bb-editable from being processed!
    Meteor.call 'fixPuzzleFolder',
      object: @puzzle._id
      name: @puzzle.name

# This is in the blackboard template and not in the blackboard_add_round template because it needs to modify
# the ReactiveVar that determines whether there is a blackboard_add_round template at all.
Template.blackboard.events okCancelEvents '#bb-new-round input',
  ok: (value, evt, template) ->
    return unless template.addRound.get()
    template.addRound.set false
    value = value.replace /^\s+|\s+$/, ''
    return unless value
    Meteor.call 'newRound', name: value

  cancel: (evt, template) ->
    template.addRound.set false

Template.blackboard_add_round.onCreated ->
  @value = new ReactiveVar ''

Template.blackboard_add_round.onRendered ->
  @$('input').focus()

Template.blackboard_add_round.helpers
  titleEditClass: ->
    val = Template.instance().value.get()
    return 'error' if not val
    cval = canonical val
    return 'error' if share.model.Rounds.findOne(canon: cval)?
    return 'success'
  titleEditStatus: ->
    val = Template.instance().value.get()
    return 'Cannot be empty' if not val
    cval = canonical val
    return "Conflicts with another round" if model.Rounds.findOne(canon: cval)?
  
Template.blackboard_add_round.events
  'input input': (event, template) ->
    template.value.set event.currentTarget.value

Template.blackboard_favorite_puzzle.onCreated ->
  @autorun =>
    return unless VISIBLE_COLUMNS.get().includes('update')
    @subscribe 'last-puzzle-room-message', Template.currentData()._id

Template.blackboard_round.onCreated ->
  @addingTag = new ReactiveVar false

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
      type: 'rounds'
      id: @_id
    }

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
      message: "Are you sure you want to delete the round \"#{template.data.name}\"?")
      Meteor.call 'deleteRound', template.data._id

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
      
Template.blackboard_unassigned.events
  'click tbody.unassigned tr.puzzle .bb-move-up': moveBeforePrevious.bind null, 'tr.puzzle', 'before'
  'click tbody.unassigned tr.puzzle .bb-move-down': moveAfterNext.bind null, 'tr.puzzle', 'after'
processBlackboardEdit =
  link: (text, id) ->
    n = model.Names.findOne(id)
    Meteor.call 'setField',
      type: n.type
      object: id
      fields: link: text

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
  'click .bb-meta-buttons .bb-add-puzzle': (event, template) ->
    puzzId = @puzzle._id
    roundId = Template.parentData()._id
    alertify.prompt "Name of new puzzle:", (e,str) =>
      return unless e # bail if cancelled
      Meteor.call 'newPuzzle',
        name: str
        feedsInto: [puzzId]
        round: roundId
      , (error,r)-> throw error if error
  'click tr.meta.collapsed .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_meta.#{template.data.puzzle._id}", false
  'click tr.meta:not(.collapsed) .collapse-toggle': (event, template) ->
    reactiveLocalStorage.setItem "collapsed_meta.#{template.data.puzzle._id}", true

Template.blackboard_meta.helpers
  color: -> puzzleColor @puzzle if @puzzle?
  showMeta: -> !HIDE_SOLVED_METAS.get() or (!this.puzzle?.solved?)
  puzzles: ->
    if @puzzle.order_by
      filter =
        feedsInto: @puzzle._id
      if not (Session.get 'canEdit') and HIDE_SOLVED.get()
        filter.solved = $eq: null
      return model.Puzzles.find filter,
        sort: {"#{@puzzle.order_by}": 1}
        transform: (p) -> {_id: p._id, puzzle: p}
    p = ({
      _id: id
      puzzle: model.Puzzles.findOne(id) or { _id: id }
    } for id, index in this.puzzle.puzzles)
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
      message: "Are you sure you want to delete the puzzle \"#{template.data.puzzle.name}\"?")
      Meteor.call 'deletePuzzle', template.data.puzzle._id


tagHelper = ->
  isRound = not ('feedsInto' of this)
  tags = this?.tags or {}
  (
    t = tags[canon]
    { _id: "#{@_id}/#{canon}", type: (if isRound then 'rounds' else 'puzzles'), id: @_id, name: t.name, canon, value: t.value, touched_by: t.touched_by }
  ) for canon in Object.keys(tags).sort() when not \
    ((Session.equals('currentPage', 'blackboard') and \
      (canon is 'status' or \
          (!isRound and canon is 'answer'))) or \
      ((canon is 'answer' or canon is 'backsolve') and \
      (Session.equals('currentPage', 'puzzle'))))

Template.blackboard_puzzle_cells.onCreated ->
  @addingTag = new ReactiveVar false

Template.blackboard_puzzle_cells.helpers
  tag: (name) ->
    return (model.getTag @puzzle, name) or ''
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
      type: 'puzzles'
      id: @_id
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
    coll = presenceIndex.get("puzzles/#{@puzzle._id}")
    unless coll?
      coll = new Mongo.Collection null
      presenceIndex.set("puzzles/#{@puzzle._id}", coll)
    return coll.find {}, sort: {jitsi: -1, joined_timestamp: 1}

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

Template.blackboard_tags.onCreated ->
  @newTagName = new ReactiveVar ''
  @autorun =>
    if Template.currentData().adding.adding()
      Tracker.afterFlush =>
        @$('.bb-add-tag input').focus()
    else
      @newTagName.set ''

Template.blackboard_tags.events
  'input/focus .bb-add-tag input': (event, template) ->
    template.newTagName.set event.currentTarget.value

Template.blackboard_tags.events okCancelEvents '.bb-add-tag input',
  ok: (value, event, template) ->
    return unless @adding.adding()
    @adding.done()
    template.newTagName.set ''
    cval = canonical value
    return if model.collection(@adding.type).findOne(_id: @adding.id).tags[cval]?
    Meteor.call 'setTag', {type: @adding.type, object: @adding.id, name: value, value: ''}
  cancel: (event, template) ->
    @adding.done()
    template.newTagName.set ''

Template.blackboard_tags.helpers
  tags: tagHelper
  tagAddClass: ->
    val = Template.instance().newTagName.get()
    return 'error' if not val
    cval = canonical val
    return 'error' if model.collection(@adding.type).findOne(_id: @adding.id).tags[cval]?
    return 'success'
  tagAddStatus: ->
    val = Template.instance().newTagName.get()
    return 'Cannot be empty' if not val
    cval = canonical val
    return 'Tag already exists' if model.collection(@adding.type).findOne(_id: @adding.id).tags[cval]?
Template.puzzle_info.helpers { tags: tagHelper }

# Subscribe to all group, round, and puzzle information
Template.blackboard.onCreated ->
  @autorun =>
    return if settings.BB_SUB_ALL
    @subscribe 'all-roundsandpuzzles'
  @autorun ->
    model.Presence.find(scope: $in: ['chat', 'jitsi']).observe
      added: (doc) ->
        coll = presenceIndex.get doc.room_name
        unless coll?
          coll = new Mongo.Collection null
          presenceIndex.set doc.room_name, coll
        coll.upsert doc.nick,
          $min: joined_timestamp: doc.joined_timestamp
          $max:
            jitsi: +(doc.scope is 'jitsi')
            chat: +(doc.scope is 'chat')
      removed: (doc) ->
        coll = presenceIndex.get doc.room_name
        return unless coll?
        coll.update doc.nick,
          $min:
            jitsi: +(doc.scope isnt 'jitsi')
            chat: +(doc.scope isnt 'chat')
        coll.remove {_id: doc.nick, jitsi: 0, chat: 0}

Template.blackboard.onDestroyed ->
  presenceIndex.clear()

Template.blackboard_column_header_working.onCreated ->
  @autorun =>
    @subscribe 'all-presence'

# Update 'currentTime' every minute or so to allow pretty_ts to magically
# update
Meteor.startup ->
  Session.set "currentTime", model.UTCNow()
  Meteor.setInterval ->
    Session.set "currentTime", model.UTCNow()
  , 60*1000
