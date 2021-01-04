'use strict'

import jitsiUrl from './imports/jitsi.coffee'
import { nickHash } from './imports/nickEmail.coffee'
import puzzleColor, { cssColorToHex, hexToCssColor } from './imports/objectColor.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'

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
      return if 'true' is reactiveLocalStorage.getItem 'mute'
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

# Returns an event map that handles the "escape" and "return" keys and
# "blur" events on a text input (given by selector) and interprets them
# as "ok" or "cancel".
# (Borrowed from Meteor 'todos' example.)
okCancelEvents = share.okCancelEvents = (selector, callbacks) ->
  ok = callbacks.ok or (->)
  cancel = callbacks.cancel or (->)
  evspec = ("#{ev} #{selector}" for ev in ['keyup','keydown','focusout'])
  events = {}
  events[evspec.join(', ')] = (evt) ->
    if evt.type is "keydown" and evt.which is 27
      # escape = cancel
      cancel.call this, evt
    else if evt.type is "keyup" and evt.which is 13 or evt.type is "focusout"
      # blur/return/enter = ok/submit if non-empty
      value = String(evt.target.value or "")
      if value
        ok.call this, value, evt
      else
        cancel.call this, evt
  events

######### general properties of the blackboard page ###########

setCompare = (was, will) ->
  return true if not was? and not will?
  return false if not was? or not will?
  was.size is will.size and [...was].every(v -> will.has v)

Template.blackboard.onCreated ->
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
    res = new Set
    p.forEach (pres) ->
      match = pres.room_name.match /puzzles\/(.*)/
      return unless match?
      res.add match[1]
    @foundPuzzles.set res
  @autorun =>
    @subscribe 'solved-puzzle-time'

Template.blackboard.helpers
  sortReverse: -> 'true' is reactiveLocalStorage.getItem 'sortReverse'
  whoseGitHub: -> settings.WHOSE_GITHUB
  filter: -> Template.instance().userSearch.get()?
  searchResults: ->
    model.Puzzles.findOne(_id: id) for id from Template.instance().foundPuzzles.get() ? []

Template.blackboard.events
  'click .puzzle-working .button-group:not(.open) .bb-show-filter-by-user': (event, template) ->
    Meteor.defer -> template.find('.bb-filter-by-user').focus()
  'click .puzzle-working .dropdown-menu *': (event, template) ->
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
]

notificationStreamsEnabled = ->
  item.name for item in notificationStreams \
    when share.notification?.get?(item.name)

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
  dir = if 'true' is reactiveLocalStorage.getItem 'sortReverse' then 'desc' else 'asc'
  model.Rounds.find {}, sort: [["sort_key", dir]]
meta_helper = ->
  # the following is a map() instead of a direct find() to preserve order
  r = for id, index in this.puzzles
    puzzle = model.Puzzles.findOne({_id: id, puzzles: {$ne: null}})
    continue unless puzzle?
    {
      _id: id
      puzzle: puzzle
      num_puzzles: puzzle.puzzles.length
    }
  return r
unassigned_helper = ->
  p = for id, index in this.puzzles
    puzzle = model.Puzzles.findOne({_id: id, feedsInto: {$size: 0}, puzzles: {$exists: false}})
    continue unless puzzle?
    { _id: id, puzzle: puzzle }
  editing = Meteor.userId() and (Session.get 'canEdit')
  hideSolved = 'true' is reactiveLocalStorage.getItem 'hideSolved'
  return p if editing or !hideSolved
  p.filter (pp) -> !pp.puzzle.solved?

############## groups, rounds, and puzzles ####################
Template.blackboard.helpers
  rounds: round_helper
  metas: meta_helper
  unassigned: unassigned_helper
  favorites: ->
    query = $or: [
      {"favorites.#{Meteor.userId()}": true},
      mechanics: $in: Meteor.user().favorite_mechanics or []
    ]
    if not Session.get('canEdit') and (('true' is reactiveLocalStorage.getItem 'hideSolved') or ('true' is reactiveLocalStorage.getItem 'hideSolvedFaves'))
      query.solved = $eq: null
    model.Puzzles.find query
  stuckPuzzles: -> model.Puzzles.find
    'tags.status.value': /^stuck/i

Template.blackboard_status_grid.helpers
  rounds: round_helper
  metas: meta_helper
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
  'click .bb-menu-drawer a': (event, template) ->
    template.$('.bb-menu-drawer').modal 'hide'
    href = event.target.getAttribute 'href'
    if href.match /^#/
      event.preventDefault()
      $(href).get(0)?.scrollIntoView block: 'center', behavior: 'smooth'

share.find_bbedit = (event) ->
  edit = $(event.currentTarget).closest('*[data-bbedit]').attr('data-bbedit')
  return edit.split('/')

Template.blackboard.onRendered ->
  #  page title
  $("title").text("#{settings.TEAM_NAME} Puzzle Blackboard")
  $('#bb-tables .bb-puzzle .puzzle-name > a').tooltip placement: 'left'
  @autorun () ->
    editing = Session.get 'editing'
    return unless editing?
    Meteor.defer () ->
      $("##{editing.split('/').join '-'}").focus()

Template.blackboard.events
  "click .bb-sort-order button": (event, template) ->
    reverse = $(event.currentTarget).attr('data-sortReverse') is 'true'
    reactiveLocalStorage.setItem 'sortReverse', reverse
  "click .bb-hide-status": (event, template) ->
    reactiveLocalStorage.setItem 'hideStatus', ('true' isnt reactiveLocalStorage.getItem 'hideStatus')
  "click .bb-add-round": (event, template) ->
    alertify.prompt "Name of new round:", (e,str) ->
      return unless e # bail if cancelled
      Meteor.call 'newRound', name: str
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
  "click .bb-round-buttons .bb-add-tag": (event, template) ->
    alertify.prompt "Name of new tag:", (e,str) =>
      return unless e # bail if cancelled
      Meteor.call 'setTag', {type:'rounds', object: @_id, name:str, value:''}
  "click .bb-puzzle-add-move .bb-add-tag": (event, template) ->
    alertify.prompt "Name of new tag:", (e,str) =>
      return unless e # bail if cancelled
      Meteor.call 'setTag', {type:'puzzles', object: @puzzle._id, name:str, value:''}
  "click .bb-canEdit .bb-delete-icon": (event, template) ->
    event.stopPropagation() # keep .bb-editable from being processed!
    [type, id, rest...] = share.find_bbedit(event)
    message = "Are you sure you want to delete "
    if (type is'tags') or (rest[0] is 'title')
      message += "this #{model.pretty_collection(type)}?"
    else
      message += "the #{rest[0]} of this #{model.pretty_collection(type)}?"
    share.confirmationDialog
      ok_button: 'Yes, delete it'
      no_button: 'No, cancel'
      message: message
      ok: ->
        processBlackboardEdit[type]?(null, id, rest...) # process delete
  "click .bb-canEdit .bb-editable": (event, template) ->
    # note that we rely on 'blur' on old field (which triggers ok or cancel)
    # happening before 'click' on new field
    Session.set 'editing', share.find_bbedit(event).join('/')
  'click input[type=color]': (event, template) ->
    event.stopPropagation()
  'input input[type=color]': (event, template) ->
    edit = $(event.currentTarget).closest('*[data-bbedit]').attr('data-bbedit')
    [type, id, rest...] = edit.split('/')
    # strip leading/trailing whitespace from text (cancel if text is empty)
    text = hexToCssColor event.currentTarget.value.replace /^\s+|\s+$/, ''
    processBlackboardEdit[type]?(text, id, rest...) if text
Template.blackboard.events okCancelEvents('.bb-editable input[type=text]',
  ok: (text, evt) ->
    # find the data-bbedit specification for this field
    edit = $(evt.currentTarget).closest('*[data-bbedit]').attr('data-bbedit')
    [type, id, rest...] = edit.split('/')
    # strip leading/trailing whitespace from text (cancel if text is empty)
    text = text.replace /^\s+|\s+$/, ''
    processBlackboardEdit[type]?(text, id, rest...) if text
    Session.set 'editing', undefined # done editing this
  cancel: (evt) ->
    Session.set 'editing', undefined # not editing anything anymore
)

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
    r.reverse() if 'true' is reactiveLocalStorage.getItem 'sortReverse'
    return r
  unassigned: unassigned_helper

Template.blackboard_round.events
  'click .bb-round-buttons .bb-move-down': (event, template) ->
    dir = if 'true' is reactiveLocalStorage.getItem 'sortReverse' then -1 else 1
    Meteor.call 'moveRound', template.data._id, dir
  'click .bb-round-buttons .bb-move-up': (event, template) ->
    dir = if 'true' is reactiveLocalStorage.getItem 'sortReverse' then 1 else -1
    Meteor.call 'moveRound', template.data._id, dir

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
  tags: (text, id, canon, field) ->
    field = 'name' if text is null # special case for delete of status tag
    processBlackboardEdit["tags_#{field}"]?(text, id, canon)
  puzzles: (text, id, field) ->
    processBlackboardEdit["puzzles_#{field}"]?(text, id)
  rounds: (text, id, field) ->
    processBlackboardEdit["rounds_#{field}"]?(text, id)
  puzzles_title: (text, id) ->
    if text is null # delete puzzle
      Meteor.call 'deletePuzzle', id
    else
      Meteor.call 'renamePuzzle', {id:id, name:text}
  rounds_title: (text, id) ->
    if text is null # delete round
      Meteor.call 'deleteRound', id
    else
      Meteor.call 'renameRound', {id:id, name:text}
  tags_name: (text, id, canon) ->
    n = model.Names.findOne(id)
    if text is null # delete tag
      return Meteor.call 'deleteTag', {type:n.type, object:id, name:canon}
    t = model.collection(n.type).findOne(id).tags[canon]
    Meteor.call 'setTag', {type:n.type, object:id, name:text, value:t.value}, (error,result) ->
      if (canon isnt model.canonical(text)) and (not error)
        Meteor.call 'deleteTag', {type:n.type, object:id, name:t.name}
  tags_value: (text, id, canon) ->
    n = model.Names.findOne(id)
    t = model.collection(n.type).findOne(id).tags[canon]
    # special case for 'status' tag, which might not previously exist
    for special in ['Status', 'Answer']
      if (not t) and canon is model.canonical(special)
        t =
          name: special
          canon: model.canonical(special)
          value: ''
    # set tag (overwriting previous value)
    Meteor.call 'setTag', {type:n.type, object:id, name:t.name, value:text}
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
    if 'true' is reactiveLocalStorage.getItem 'sortReverse'
      rel = 'after'
    moveBeforePrevious 'tbody.meta', rel, event, template
  'click tbody.meta tr.meta .bb-move-down': (event, template) ->
    rel = 'after'
    if 'true' is reactiveLocalStorage.getItem 'sortReverse'
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
        round: roundId,
      (error,r)-> throw error if error

Template.blackboard_meta.helpers
  color: -> puzzleColor @puzzle if @puzzle?
  showMeta: -> ('true' isnt reactiveLocalStorage.getItem 'hideSolvedMeta') or (!this.puzzle?.solved?)
  # the following is a map() instead of a direct find() to preserve order
  puzzles: ->
    p = ({
      _id: id
      puzzle: model.Puzzles.findOne(id) or { _id: id }
    } for id, index in this.puzzle.puzzles)
    editing = Meteor.userId() and (Session.get 'canEdit')
    hideSolved = 'true' is reactiveLocalStorage.getItem 'hideSolved'
    return p if editing or !hideSolved
    p.filter (pp) -> !pp.puzzle.solved?
  tag: (name) ->
    return (model.getTag this.round, name) or ''
  whos_working: ->
    return model.Presence.find
      room_name: ("rounds/"+this.round?._id)
    , sort: ["nick"]
  stuck: share.model.isStuck
  numHidden: ->
    return 0 unless 'true' is reactiveLocalStorage.getItem 'hideSolved'
    y = for id, index in @puzzle.puzzles
      x = model.Puzzles.findOne id
      continue unless x?.solved?
    y.length


Template.blackboard_puzzle_cells.events
  'change .bb-set-is-meta': (event, template) ->
    if event.target.checked
      Meteor.call 'makeMeta', template.data.puzzle._id
    else
      Meteor.call 'makeNotMeta', template.data.puzzle._id
  'click .bb-feed-meta a[data-puzzle-id]': (event, template) ->
    Meteor.call 'feedMeta', template.data.puzzle._id, event.target.dataset.puzzleId
    event.preventDefault()

tagHelper = ->
  isRound = not ('feedsInto' of this)
  tags = this?.tags or {}
  (
    t = tags[canon]
    { _id: "#{@_id}/#{canon}", id: @_id, name: t.name, canon, value: t.value }
  ) for canon in Object.keys(tags).sort() when not \
    ((Session.equals('currentPage', 'blackboard') and \
      (canon is 'status' or \
          (!isRound and canon is 'answer'))) or \
      ((canon is 'answer' or canon is 'backsolve') and \
      (Session.equals('currentPage', 'puzzle'))))

Template.blackboard_puzzle_cells.helpers
  tag: (name) ->
    return (model.getTag @puzzle, name) or ''
  tags: tagHelper
  hexify: (v) -> cssColorToHex v
  whos_working: ->
    return model.Presence.find
      room_name: ("puzzles/"+@puzzle?._id)
    , sort: ["nick"]
  stuck: share.model.isStuck
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
  solverMinutes: ->
    return unless @puzzle.solverTime?
    Math.floor(@puzzle.solverTime / 60000)

colorHelper = -> model.getTag @, 'color'

Template.blackboard_othermeta_link.helpers color: colorHelper
Template.blackboard_addmeta_entry.helpers color: colorHelper

Template.blackboard_unfeed_meta.events
  'click .bb-unfeed-icon': (event, template) ->
    Meteor.call 'unfeedMeta', template.data.puzzle._id, template.data.meta._id

PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle'

dragdata = null

Template.blackboard_puzzle.helpers
  stuck: share.model.isStuck

Template.blackboard_puzzle.events
  'dragend tr.puzzle': (event, template) ->
    dragdata = null
  'dragstart tr.puzzle': (event, template) ->
    event = event.originalEvent
    rect = event.target.getBoundingClientRect()
    unless Meteor.isProduction
      console.log "event Y #{event.clientY} rect #{JSON.stringify rect}"
      console.log @puzzle._id
    dragdata =
      id: @puzzle._id
      fromTop: event.clientY - rect.top
      fromBottom: rect.bottom - event.clientY
    dragdata.meta = Template.parentData(1).puzzle?._id
    dragdata.round = Template.parentData(2)?._id
    console.log "meta id #{dragdata.meta}, round id #{dragdata.round}"
    dt = event.dataTransfer
    dt.setData PUZZLE_MIME_TYPE, dragdata.id
    dt.effectAllowed = 'move'
  'dragover tr.puzzle': (event, template) ->
    event = event.originalEvent
    return unless event.dataTransfer.types.includes PUZZLE_MIME_TYPE
    myId = template.data.puzzle._id
    if dragdata.id is myId
      event.preventDefault()  # Drop okay
      return  # ... but nothing to do
    parentData = Template.parentData(1)
    meta = Template.parentData(1).puzzle
    round = Template.parentData(2)
    return unless meta?._id is dragdata.meta
    return unless round?._id is dragdata.round
    event.preventDefault()
    parent = meta or round
    myIndex = parent.puzzles.indexOf myId
    itsIndex = parent.puzzles.indexOf dragdata.id
    diff = itsIndex - myIndex
    rect = event.target.getBoundingClientRect()
    clientY = event.clientY
    args = null
    if clientY - rect.top < dragdata.fromTop
      return if diff == -1
      args = before: myId
    else if rect.bottom - clientY < dragdata.fromBottom
      return if diff == 1
      args = after: myId
    else if diff > 1
      args = after: myId
    else if diff < -1
      args = before: myId
    else
      return
    if meta?
      Meteor.call 'moveWithinMeta', dragdata.id, meta._id, args
    else if round?
      Meteor.call 'moveWithinRound', dragdata.id, round._id, args

Template.blackboard_tags.helpers { tags: tagHelper }
Template.puzzle_info.helpers { tags: tagHelper }

# Subscribe to all group, round, and puzzle information
Template.blackboard.onCreated -> this.autorun =>
  this.subscribe 'all-presence'
  return if settings.BB_SUB_ALL
  this.subscribe 'all-roundsandpuzzles'

# Update 'currentTime' every minute or so to allow pretty_ts to magically
# update
Meteor.startup ->
  Session.set "currentTime", model.UTCNow()
  Meteor.setInterval ->
    Session.set "currentTime", model.UTCNow()
  , 60*1000
