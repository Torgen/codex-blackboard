'use strict'
import './logistics.html'
import './logistics.less'
import '/client/imports/ui/components/create_object/create_object.coffee'
import { confirm } from '/client/imports/modal.coffee'
import { findByChannel } from '/client/imports/presence_index.coffee'
import colorFromThingWithTags from '/client/imports/objectColor.coffee'
import { isStuck } from '/lib/imports/tags.coffee'

nameAndUrlFromDroppedLink = (dataTransfer) ->
  url = dataTransfer.getData 'url'
  name = if dataTransfer.types.includes 'text/html'
    doc = new DOMParser().parseFromString dataTransfer.getData('text/html'), 'text/html'
    doc.body.innerText
  else
    parsedUrl = new URL link
    parsedUrl.pathname().split('/').at(-1)
  {name, url}
  
PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle'
CALENDAR_EVENT_MIME_TYPE = 'application/prs.codex-calendar-event'

draggedPuzzle = new ReactiveDict
editingPuzzle = new ReactiveVar

Template.logistics.onCreated ->
  Session.set 'topRight', 'logistics_topright_panel'
  # This is tristate because if you click the button while it's open, you expect it to close,
  # but the click is received after the focusout event on the contents closes it, which
  # reopens it.
  @creatingRound = new ReactiveVar 0
  # for meta and puzzle the above isn't necessary because the text box is outside the dropdown
  # These store the round the meta/puzzle are being created in.
  @creatingMeta = new ReactiveVar null
  @creatingPuzzle = new ReactiveVar null
  @autorun =>
    @subscribe 'all-presence'

Template.logistics.onRendered ->
  $("title").text("Logistics")
  @autorun =>
    if editingPuzzle.get()?
      @$('#bb-logistics-edit-dialog').modal 'show'
      $(document).on 'keydown.dismiss-edit-dialog', (e) =>
        if e.which is 27
          @$('#bb-logistics-edit-dialog').modal 'hide'

Template.logistics.helpers
  rounds: ->
    share.model.Rounds.find({}, sort: sort_key: 1)
  standalone: (round) ->
    x = []
    for puzzle in round.puzzles
      puz = share.model.Puzzles.findOne _id: puzzle
      x.push puz if puz.feedsInto.length is 0 and not puz.puzzles?
    x if x.length
  metas: (round) ->
    x = []
    for puzzle in round.puzzles
      puz = share.model.Puzzles.findOne _id: puzzle
      x.push puz if puz.puzzles?
    x
  metaParams: (round) -> { round, puzzles: [] }
  puzzleParams: (round) -> { round }
  creatingRound: -> Template.instance().creatingRound.get() is 2
  doneCreatingRound: ->
    instance = Template.instance()
    return done: ->
      wasStillCreating = instance.creatingRound.get()
      instance.creatingRound.set 0
      return wasStillCreating is 2
  creatingMeta: -> Template.instance().creatingMeta.get()
  doneCreatingMeta: ->
    instance = Template.instance()
    return done: ->
      wasStillCreating = instance.creatingMeta.get()
      instance.creatingMeta.set null
      return wasStillCreating?
  creatingStandalone: -> Template.instance().creatingPuzzle.get()
  doneCreatingStandalone: ->
    instance = Template.instance()
    return done: ->
      wasStillCreating = instance.creatingPuzzle.get()
      instance.creatingPuzzle.set null
      return wasStillCreating?
  unfeeding: ->
    if draggedPuzzle.get('meta')? and not draggedPuzzle.get('targetMeta')?
      puzz = share.model.Puzzles.findOne(_id: draggedPuzzle.get 'id')
      return puzz if puzz?.feedsInto.length is 1
  editingPuzzle: ->
    _id = editingPuzzle.get()
    if _id?
      share.model.Puzzles.findOne({_id})
  modalColor: ->
    p = share.model.Puzzles.findOne(_id: editingPuzzle.get())
    colorFromThingWithTags p if p?
       

allowDropUriList = (event, template) ->
  if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
    return
  if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
    event.preventDefault()
    event.stopPropagation()
    event.originalEvent.dataTransfer.dropEffect = 'copy'

lastEnter = null

toggleButtonOnDragEnter = (event, template) ->
  if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
    return
  if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
    unless event.currentTarget.classList.contains 'open'
      $(event.currentTarget).dropdown('toggle')
    event.currentTarget.classList.add 'dragover'
    lastEnter = event.target

closeButtonOnDragLeave = (event, template) ->
  if event.target is lastEnter
    lastEnter = null
  else if event.currentTarget.contains lastEnter
    return
  if event.currentTarget.classList.contains 'open'
    $(event.currentTarget).dropdown('toggle')
  event.currentTarget.classList.remove 'dragover'

Template.logistics.events
  'mousedown #bb-logistics-new-round:not(.open)': (event, template) ->
    template.creatingRound.set 1
  'click #bb-logistics-new-round': (event, template) ->
    if template.creatingRound.get() is 1
      template.creatingRound.set 2
  'click .dropdown-menu.stay-open': (event, template) ->
    event.stopPropagation()
  'click #bb-logistics-new-meta a.round-name': (event, template) ->
    template.creatingMeta.set @_id
  'click #bb-logistics-new-standalone a.round-name': (event, template) ->
    template.creatingPuzzle.set @_id
    
  'dragstart .bb-logistics-standalone .puzzle': (event, template) ->
    data = {id: @_id, meta: null}
    draggedPuzzle.set data
    event.originalEvent.dataTransfer.setData PUZZLE_MIME_TYPE, JSON.stringify(data)
    event.originalEvent.dataTransfer.effectAllowed = 'all'
  'dragstart .bb-calendar-event': (event, template) ->
    event.originalEvent.dataTransfer.setData CALENDAR_EVENT_MIME_TYPE, @event._id
    event.originalEvent.dataTransfer.effectAllowed = 'link'
  'dragend .bb-logistics-standalone .puzzle': (event, template) ->
    draggedPuzzle.clear()
  'dragover .bb-logistics': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      if draggedPuzzle.get('meta')?
        event.originalEvent.dataTransfer.dropEffect = 'move'
      else
        event.originalEvent.dataTransfer.dropEffect = 'none'
    else
      event.originalEvent.dataTransfer.dropEffect = 'none'
    event.stopPropagation()
    event.preventDefault()
  'dragover #bb-logistics-new-round': allowDropUriList
  'dragover #bb-logistics-new-meta .round-name': allowDropUriList
  'dragover #bb-logistics-new-standalone .round-name': allowDropUriList
  'dragover #bb-logistics-delete': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      event.originalEvent.dataTransfer.dropEffect = 'move'
      event.stopPropagation()
      event.preventDefault()
  'dragenter li:not(.disabled)': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.currentTarget.classList.add 'active'
  'dragleave li:not(.disabled)': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.currentTarget.classList.remove 'active'
  'dragenter #bb-logistics-new-round': toggleButtonOnDragEnter
  'dragenter #bb-logistics-new-meta': toggleButtonOnDragEnter
  'dragenter #bb-logistics-new-standalone': toggleButtonOnDragEnter
  'dragenter #bb-logistics-delete': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      event.currentTarget.classList.add 'dragover'
      lastEnter = event.target
      draggedPuzzle.set 'willDelete', true

  'dragleave #bb-logistics-new-round': closeButtonOnDragLeave
  'dragleave #bb-logistics-new-meta': closeButtonOnDragLeave
  'dragleave #bb-logistics-new-standalone': closeButtonOnDragLeave
  'dragleave #bb-logistics-delete': (event, template) ->
    if event.target is lastEnter
      lastEnter = null
    else if event.currentTarget.contains lastEnter
      return
    event.currentTarget.classList.remove 'dragover'
    draggedPuzzle.set 'willDelete', false
  'drop .bb-logistics': (event, template) ->
    return unless event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
    event.preventDefault()
    event.stopPropagation()
    data = JSON.parse event.originalEvent.dataTransfer.getData PUZZLE_MIME_TYPE
    if data.meta?
      Meteor.call 'unfeedMeta', data.id, data.meta
  
  'drop #bb-logistics-new-round': (event, template) ->
    event.currentTarget.classList.remove 'dragover'
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      return
    if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.preventDefault()
      {name, url} = nameAndUrlFromDroppedLink event.originalEvent.dataTransfer
      Meteor.call 'newRound',
        name: name
        link: url
  'drop #bb-logistics-new-meta, drop #bb-logistics-new-standalone': (event, template) ->
    lastEnter = null
    event.currentTarget.classList.remove 'dragover'
    if event.currentTarget.classList.contains 'open'
      $(event.currentTarget).dropdown('toggle')

  'drop #bb-logistics-new-meta .round-name': (event, template) ->
    event.currentTarget.closest('#bb-logistics-new-meta').classList.remove 'dragover'
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      return
    if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.preventDefault()
      {name, url} = nameAndUrlFromDroppedLink event.originalEvent.dataTransfer
      Meteor.call 'newPuzzle',
        name: name
        link: url
        round: @_id
        puzzles: []
  'drop #bb-logistics-new-standalone .round-name': (event, template) ->
    event.currentTarget.closest('#bb-logistics-new-standalone').classList.remove 'dragover'
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      return
    if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.preventDefault()
      {name, url} = nameAndUrlFromDroppedLink event.originalEvent.dataTransfer
      Meteor.call 'newPuzzle',
        name: name
        link: url
        round: @_id
  'drop #bb-logistics-delete': (event, template) ->
    event.currentTarget.classList.remove 'dragover'
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      event.preventDefault()
      event.stopPropagation()
      data = JSON.parse event.originalEvent.dataTransfer.getData PUZZLE_MIME_TYPE
      puzzle = share.model.Puzzles.findOne {_id: data.id}
      if puzzle?
        if (await confirm
          ok_button: 'Yes, delete it'
          no_button: 'No, cancel'
          message: "Are you sure you want to delete the puzzle \"#{puzzle.name}\"?")
          Meteor.call 'deletePuzzle', puzzle._id
  'hidden #bb-logistics-edit-dialog': (event, template) ->
    editingPuzzle.set null
    $(document).off 'keydown.dismiss-edit-dialog'

Template.logistics_puzzle.helpers
  stuck: isStuck
  willDelete: ->
    unless draggedPuzzle.equals('id', @_id)
      return false
    if draggedPuzzle.get('willDelete') 
      return true
    targetMeta = draggedPuzzle.get('targetMeta')
    if targetMeta?
      return @feedsInto.length is 0
    else
      return draggedPuzzle.equals('meta', Template.parentData()?.meta?._id)
  draggingIn: ->
    localMeta = Template.parentData()?.meta
    return false unless localMeta?
    return draggedPuzzle.equals('id', @_id) and draggedPuzzle.equals('targetMeta',localMeta._id) and not @feedsInto.includes draggedPuzzle.get 'targetMeta'

Template.logistics_puzzle.events
  'click .bb-logistics-edit-puzzle': (event, template) ->
    return unless event.button is 0
    return if event.ctrlKey or event.altKey or event.metaKey
    event.preventDefault()
    event.stopPropagation()
    editingPuzzle.set @_id
  'dragover .puzzle': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes CALENDAR_EVENT_MIME_TYPE
      event.originalEvent.dataTransfer.dropEffect = 'link'
      event.preventDefault()
      event.stopPropagation()
  'drop .puzzle': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes CALENDAR_EVENT_MIME_TYPE
      id = event.originalEvent.dataTransfer.getData CALENDAR_EVENT_MIME_TYPE
      Meteor.call 'setPuzzleForEvent', id, @_id
      event.preventDefault()
      event.stopPropagation()

Template.logistics_puzzle_events.helpers
  soonest_ending_current_event: ->
    now = Session.get 'currentTime'
    share.model.CalendarEvents.findOne({puzzle: @_id, start: {$lt: now}, end: {$gt: now}}, {sort: end: -1})
  next_future_event: ->
    now = Session.get 'currentTime'
    share.model.CalendarEvents.findOne({puzzle: @_id, start: {$gt: now}}, {sort: start: 1})
  no_events: ->
    share.model.CalendarEvents.find({puzzle: @_id}).count() is 0

Template.logistics_meta.onCreated ->
  @creatingFeeder = new ReactiveVar false
  @draggingLink = new ReactiveVar false

Template.logistics_meta.events
  'click .new-puzzle': (event, template) ->
    template.creatingFeeder.set true
  'click header .bb-logistics-edit-puzzle': (event, template) ->
    return unless event.button is 0
    return if event.ctrlKey or event.altKey or event.metaKey
    event.preventDefault()
    event.stopPropagation()
    editingPuzzle.set @meta._id
  'dragstart .feeders .puzzle': (event, template) ->
    data = {id: @_id, meta: template.data.meta._id, targetMeta: template.data.meta._id}
    draggedPuzzle.set data
    event.originalEvent.dataTransfer.setData PUZZLE_MIME_TYPE, JSON.stringify(data)
    event.originalEvent.dataTransfer.effectAllowed = 'all'
  'dragstart header .meta': (event, template) ->
    data = {id: @meta._id, meta: null}
    draggedPuzzle.set data
    event.originalEvent.dataTransfer.setData PUZZLE_MIME_TYPE, JSON.stringify(data)
    event.originalEvent.dataTransfer.effectAllowed = 'all'
  'dragend .feeders .puzzle, dragend .meta': (event, template) ->
    draggedPuzzle.clear()
  'dragover header .meta': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes CALENDAR_EVENT_MIME_TYPE
      event.originalEvent.dataTransfer.dropEffect = 'link'
      event.preventDefault()
      event.stopPropagation()
  'dragover .bb-logistics-meta': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      if draggedPuzzle.equals 'meta', template.data.meta._id
        event.originalEvent.dataTransfer.dropEffect = 'none'
      else
        event.originalEvent.dataTransfer.dropEffect = 'link'
    else if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.originalEvent.dataTransfer.dropEffect = 'copy'
    else return
    event.preventDefault()
    event.stopPropagation()
  'dragenter .bb-logistics-meta': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      draggedPuzzle.set 'targetMeta', @meta._id
    else unless event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      return
    template.draggingLink.set event.target
  'dragleave .bb-logistics-meta': (event, template) ->
    return unless template.draggingLink.get() is event.target
    template.draggingLink.set null
    draggedPuzzle.set 'targetMeta', null
  'drop header .meta': (event, template) ->
    if event.originalEvent.dataTransfer.types.includes CALENDAR_EVENT_MIME_TYPE
      id = event.originalEvent.dataTransfer.getData CALENDAR_EVENT_MIME_TYPE
      Meteor.call 'setPuzzleForEvent', id, @meta._id
      event.preventDefault()
      event.stopPropagation()
  'drop .bb-logistics-meta': (event, template) ->
    template.draggingLink.set null
    if event.originalEvent.dataTransfer.types.includes PUZZLE_MIME_TYPE
      event.preventDefault()
      event.stopPropagation()
      data = JSON.parse event.originalEvent.dataTransfer.getData PUZZLE_MIME_TYPE
      return if data.meta is template.data.meta._id
      Meteor.call 'feedMeta', data.id, template.data.meta._id
    else if event.originalEvent.dataTransfer.types.includes 'text/uri-list'
      event.preventDefault()
      {name, url} = nameAndUrlFromDroppedLink event.originalEvent.dataTransfer
      Meteor.call 'newPuzzle',
        name: name
        link: url
        feedsInto: [@meta._id]
        round: @round._id

Template.logistics_meta.helpers
  color: -> colorFromThingWithTags @meta
  puzzles: -> @meta.puzzles.map (_id) -> share.model.Puzzles.findOne {_id}
  stuck: isStuck
  feederParams: ->
    round: @round._id
    feedsInto: [@meta._id]
  creatingFeeder: -> Template.instance().creatingFeeder.get()
  draggingLink: -> Template.instance().draggingLink.get()
  doneCreatingFeeder: ->
    instance = Template.instance()
    return done: ->
      wasStillCreating = instance.creatingFeeder.get()
      instance.creatingFeeder.set false
      return wasStillCreating
  willDelete: ->
    draggedPuzzle.get('willDelete') and draggedPuzzle.equals('id', @meta._id)
  fromAnotherMeta: ->
    return not draggedPuzzle.equals 'meta', @meta._id
  draggedPuzzle: -> share.model.Puzzles.findOne(_id: draggedPuzzle.get('id'))

Template.logistics_puzzle_presence.helpers
  presenceForScope: (scope) ->
    return findByChannel("puzzles/#{@_id}", {[scope]: 1}, {fields: [scope]: 1}).count()
