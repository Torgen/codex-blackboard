'use strict'

import { nickEmail } from './imports/nickEmail.coffee'

model = share.model # import
settings = share.settings # import

NAVBAR_HEIGHT = 73 # keep in sync with @navbar-height in blackboard.less
SOUND_THRESHOLD_MS = 30*1000 # 30 seconds

blackboard = {} # store page global state

Meteor.startup ->
  if typeof Audio is 'function' # for phantomjs
    blackboard.newAnswerSound = new Audio "sound/that_was_easy.wav"
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
      if 'true' isnt reactiveLocalStorage.getItem 'mute'
        blackboard.newAnswerSound?.play?()
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
compactMode = ->
  editing = Meteor.userId() and Session.get 'canEdit'
  ('true' is reactiveLocalStorage.getItem 'compactMode') and not editing
nCols = -> if compactMode() then 2 else \
  (if (Meteor.userId() and Session.get 'canEdit') then 3 else 5)
Template.blackboard.helpers
  sortReverse: -> 'true' is reactiveLocalStorage.getItem 'sortReverse'
  hideSolved: -> 'true' is reactiveLocalStorage.getItem 'hideSolved'
  hideRoundsSolvedMeta: -> 'true' is reactiveLocalStorage.getItem 'hideRoundsSolvedMeta'
  hideStatus: -> 'true' is reactiveLocalStorage.getItem 'hideStatus'
  compactMode: compactMode
  nCols: nCols

# Notifications
notificationStreams = [
  {name: 'new-puzzles', label: 'New Puzzles'}
  {name: 'announcements', label: 'Announcements'}
  {name: 'callins', label: "Call-Ins"}
  {name: 'answers', label: "Answers"}
  {name: 'stuck', label: 'Stuck Puzzles'}
]

notificationStreamsEnabled = ->
  item.name for item in notificationStreams \
    when share.notification?.get?(item.name)

Template.blackboard.helpers
  notificationStreams: notificationStreams
  notificationsAsk: ->
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

############## groups, rounds, and puzzles ####################
Template.blackboard.helpers
  roundgroups: ->
    dir = if 'true' is reactiveLocalStorage.getItem 'sortReverse' then 'desc' else 'asc'
    model.RoundGroups.find {}, sort: [["created", dir]]
  # the following is a map() instead of a direct find() to preserve order
  rounds: ->
    r = ({
      round_num: 1+index+this.round_start
      round: (model.Rounds.findOne(id) or \
              {_id: id, name: model.Names.findOne(id)?.name, puzzles: []})
      rX: "r#{1+index+this.round_start}"
      num_puzzles: (model.Rounds.findOne(id)?.puzzles or []).length
      num_solved: (p for p in (model.Rounds.findOne(id)?.puzzles or []) when \
                   model.Puzzles.findOne(p)?.solved?).length
    } for id, index in this.rounds)
    r.reverse() if 'true' is reactiveLocalStorage.getItem 'sortReverse'
    return r
  stuck: share.model.isStuck

Template.blackboard_status_grid.helpers
  roundgroups: ->
    dir = if 'true' is reactiveLocalStorage.getItem 'sortReverse' then 'desc' else 'asc'
    model.RoundGroups.find {}, sort: [["created", dir]]
  # the following is a map() instead of a direct find() to preserve order
  rounds: ->
    r = ({
      round_num: 1+index+this.round_start
      round: (model.Rounds.findOne(id) or \
              {_id: id, name: model.Names.findOne(id)?.name, puzzles: []})
      rX: "r#{1+index+this.round_start}"
      num_puzzles: (model.Rounds.findOne(id)?.puzzles or []).length
    } for id, index in this.rounds)
    return r
  puzzles: ->
    p = ({
      round_num: this.x_num
      puzzle_num: 1 + index
      puzzle: model.Puzzles.findOne(id) or { _id: id }
      rXpY: "r#{this.round_num}p#{1+index}"
      pY: "p#{1+index}"
    } for id, index in this.round?.puzzles)
    return p
  stuck: share.model.isStuck

Template.blackboard.events
  "click .bb-menu-button .btn": (event, template) ->
    template.$('.bb-menu-drawer').modal 'show'
  "click a[href^='#']": (event, template) ->
    event.preventDefault()
    template.$('.bb-menu-drawer').modal 'hide'
    $.scrollTo (event.target.getAttribute 'href'),
      duration: 400
      offset: { top: -110 }

Template.nick_presence.helpers
  email: -> nickEmail @nick

share.find_bbedit = (event) ->
  edit = $(event.currentTarget).closest('*[data-bbedit]').attr('data-bbedit')
  return edit.split('/')

Template.blackboard.onRendered ->
  #  page title
  $("title").text("Codex Ogg Puzzle Blackboard")
  $('#bb-tables .bb-puzzle .puzzle-name > a').tooltip placement: 'left'
  @autorun () ->
    editing = Session.get 'editing'
    return unless editing?
    Meteor.defer () ->
      $("##{editing.split('/').join '-'}").focus()

doBoolean = (name, newVal) ->
  reactiveLocalStorage.setItem name, newVal
Template.blackboard.events
  "click .bb-sort-order button": (event, template) ->
    reverse = $(event.currentTarget).attr('data-sortReverse') is 'true'
    doBoolean 'sortReverse', reverse
  "change .bb-hide-solved input": (event, template) ->
    doBoolean 'hideSolved', event.target.checked
  "change .bb-hide-rounds-solved-meta input": (event, template) ->
    doBoolean 'hideRoundsSolvedMeta', event.target.checked
  "change .bb-compact-mode input": (event, template) ->
    doBoolean 'compactMode', event.target.checked
  "click .bb-hide-status": (event, template) ->
    doBoolean 'hideStatus', ('true' isnt reactiveLocalStorage.getItem 'hideStatus')
  "click .bb-add-round-group": (event, template) ->
    alertify.prompt "Name of new round group:", (e,str) ->
      return unless e # bail if cancelled
      Meteor.call 'newRoundGroup', name: str
  "click .bb-roundgroup-buttons .bb-add-round": (event, template) ->
    [type, id, rest...] = share.find_bbedit(event)
    who = Meteor.userId()
    alertify.prompt "Name of new round:", (e,str) ->
      return unless e # bail if cancelled
      Meteor.call 'newRound', { name: str }, (error,r)->
        throw error if error
        Meteor.call 'addRoundToGroup', {round: r._id, group: id}
  "click .bb-round-buttons .bb-add-puzzle": (event, template) ->
    [type, id, rest...] = share.find_bbedit(event)
    who = Meteor.userId()
    alertify.prompt "Name of new puzzle:", (e,str) ->
      return unless e # bail if cancelled
      Meteor.call 'newPuzzle', { name: str }, (error,p)->
        throw error if error
        Meteor.call 'addPuzzleToRound', {puzzle: p._id, round: id}
  "click .bb-add-tag": (event, template) ->
    [type, id, rest...] = share.find_bbedit(event)
    who = Meteor.userId()
    alertify.prompt "Name of new tag:", (e,str) ->
      return unless e # bail if cancelled
      Meteor.call 'setTag', {type:type, object:id, name:str, value:''}
  "click .bb-move-up, click .bb-move-down": (event, template) ->
    [type, id, rest...] = share.find_bbedit(event)
    up = event.currentTarget.classList.contains('bb-move-up')
    # flip direction if sort order is inverted
    up = (!up) if ('true' is reactiveLocalStorage.getItem 'sortReverse') and type isnt 'puzzles'
    method = if up then 'moveUp' else 'moveDown'
    Meteor.call method, {type:type, id:id}
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
Template.blackboard.events okCancelEvents('.bb-editable input',
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
processBlackboardEdit =
  tags: (text, id, canon, field) ->
    field = 'name' if text is null # special case for delete of status tag
    processBlackboardEdit["tags_#{field}"]?(text, id, canon)
  puzzles: (text, id, field) ->
    processBlackboardEdit["puzzles_#{field}"]?(text, id)
  rounds: (text, id, field) ->
    processBlackboardEdit["rounds_#{field}"]?(text, id)
  roundgroups: (text, id, field) ->
    processBlackboardEdit["roundgroups_#{field}"]?(text, id)
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
  roundgroups_title: (text, id) ->
    if text is null # delete roundgroup
      Meteor.call 'deleteRoundGroup', id
    else
      Meteor.call 'renameRoundGroup', {id:id,name:text}
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

Template.blackboard_round.helpers
  hasPuzzles: -> (this.round?.puzzles?.length > 0)
  showRound: ->
    return false if ('true' is reactiveLocalStorage.getItem 'hideRoundsSolvedMeta') and (this.round?.solved?)
    return ('true' isnt reactiveLocalStorage.getItem 'hideSolved') or (!this.round?.solved?) or
    ((model.Puzzles.findOne(id) for id, index in this.round?.puzzles ? []).
      filter (p) -> !p?.solved?).length > 0
  showMeta: -> ('true' isnt reactiveLocalStorage.getItem 'hideSolved') or (!this.round?.solved?)
  # the following is a map() instead of a direct find() to preserve order
  puzzles: ->
    p = ({
      round_num: this.round_num
      puzzle_num: 1 + index
      puzzle: model.Puzzles.findOne(id) or { _id: id }
      rXpY: "r#{this.round_num}p#{1+index}"
    } for id, index in this.round.puzzles)
    editing = Meteor.userId() and Session.get 'canEdit'
    hideSolved = 'true' is reactiveLocalStorage.getItem 'hideSolved'
    return p if editing or !hideSolved
    p.filter (pp) ->  !pp.puzzle.solved?
  tag: (name) ->
    return (model.getTag this.round, name) or ''
  whos_working: ->
    return model.Presence.find
      room_name: ("rounds/"+this.round?._id)
    , sort: ["nick"]
  compactMode: compactMode
  nCols: nCols
  stuck: share.model.isStuck 

Template.blackboard_puzzle.helpers
  tag: (name) ->
    return (model.getTag this.puzzle, name) or ''
  whos_working: ->
    return model.Presence.find
      room_name: ("puzzles/"+this.puzzle?._id)
    , sort: ["nick"]
  compactMode: compactMode
  nCols: nCols
  stuck: share.model.isStuck

PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle'

dragdata = null

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
    dt = event.dataTransfer
    dt.setData PUZZLE_MIME_TYPE, dragdata.id
    dt.effectAllowed = 'move'
  'dragover tr.puzzle': (event, template) ->
    event = event.originalEvent
    return unless event.dataTransfer.types.includes PUZZLE_MIME_TYPE
    myId = @puzzle._id
    if dragdata.id is myId
      event.preventDefault()  # Drop okay
      return  # ... but nothing to do
    parent = share.model.Rounds.findOne {puzzles: dragdata.id}
    console.log "itsparent #{parent._id}" unless Meteor.isProduction
    # Can't drop into another round for now.
    return unless parent._id is (share.model.Rounds.findOne {puzzles: myId})._id
    event.preventDefault()
    myIndex = parent.puzzles.indexOf myId
    itsIndex = parent.puzzles.indexOf dragdata.id
    diff = itsIndex - myIndex
    rect = event.target.getBoundingClientRect()
    clientY = event.clientY
    args =
      round: parent
      puzzle: dragdata.id
    if clientY - rect.top < dragdata.fromTop
      return if diff == -1
      args.before = myId
    else if rect.bottom - clientY < dragdata.fromBottom
      return if diff == 1
      args.after = myId
    else if diff > 1
      args.after = myId
    else if diff < -1
      args.before = myId
    else
      return
    Meteor.call 'addPuzzleToRound', args

Template.blackboard_round.events
  'dragover tr.meta': (event, template) ->
    event = event.originalEvent
    return unless event.dataTransfer.types.includes PUZZLE_MIME_TYPE
    return unless @round._id is (share.model.Rounds.findOne {puzzles: dragdata.id})._id
    event.preventDefault()
    puzzles = @round.puzzles
    return unless puzzles.length
    firstPuzzle = puzzles[0]
    return if firstPuzzle is dragdata.id
    Meteor.call 'addPuzzleToRound',
      round: @round
      puzzle: dragdata.id
      before: firstPuzzle
  'dragover tr.roundfooter': (event, template) ->
    event = event.originalEvent
    return unless event.dataTransfer.types.includes PUZZLE_MIME_TYPE
    return unless @round._id is (share.model.Rounds.findOne {puzzles: dragdata.id})._id
    event.preventDefault()
    puzzles = @round.puzzles
    len = puzzles.length
    return unless len
    lastpuzzle = puzzles[len-1]
    return if lastpuzzle is dragdata.id
    Meteor.call 'addPuzzleToRound',
      round: @round
      puzzle: dragdata.id
      after: lastpuzzle

tagHelper = (id) ->
  isRoundGroup = ('rounds' of this)
  tags = this?.tags or {}
  (
    t = tags[canon]
    { id, name: t.name, canon, value: t.value }
  ) for canon in Object.keys(tags).sort() when not \
    ((Session.equals('currentPage', 'blackboard') and \
      (canon is 'status' or \
          (!isRoundGroup and canon is 'answer'))) or \
      ((canon is 'answer' or canon is 'backsolve') and \
      (Session.equals('currentPage', 'puzzle') or \
        Session.equals('currentPage', 'round'))))

Template.blackboard_tags.helpers { tags: tagHelper }
Template.blackboard_puzzle_tags.helpers { tags: tagHelper }
Template.puzzle_info.helpers { tags: tagHelper }

# Subscribe to all group, round, and puzzle information
Template.blackboard.onCreated -> this.autorun =>
  this.subscribe 'all-presence'
  return if settings.BB_SUB_ALL
  this.subscribe 'all-roundsandpuzzles'

# Update 'currentTime' every minute or so to allow pretty_ts to magically
# update
Meteor.startup ->
  Meteor.setInterval ->
    Session.set "currentTime", model.UTCNow()
  , 60*1000
