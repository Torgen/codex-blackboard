'use strict'

import { nickEmail } from './imports/nickEmail.coffee'
import color from './imports/objectColor.coffee'
import embeddable from './imports/embeddable.coffee'
import * as callin_types from '/lib/imports/callin_types.coffee'

model = share.model # import
settings = share.settings # import

capType = (puzzle) ->
  if puzzle?.puzzles?
    'Meta'
  else
    'Puzzle'

possibleViews = (puzzle) ->
  x = []
  x.push 'spreadsheet' if puzzle?.spreadsheet?
  x.push 'puzzle' if embeddable puzzle?.link
  x.push 'info'
  x.push 'doc' if puzzle?.doc?
  x
currentViewIs = (puzzle, view) ->
  # only puzzle and round have view.
  page = Session.get 'currentPage'
  return false unless (page is 'puzzle') or (page is 'round')
  possible = possibleViews puzzle
  if Session.equals 'view', view
    return true if possible.includes view
  return false if possible.includes Session.get 'view'
  return view is possible[0]

Template.puzzle_info.onCreated ->
  @autorun =>
    id = Session.get 'id'
    return unless id
    @subscribe 'callins-by-puzzle', id

Template.puzzle_info.helpers
  tag: (name) -> (model.getTag this, name) or ''
  getPuzzle: -> model.Puzzles.findOne this
  caresabout: ->
    cared = model.getTag @puzzle, "Cares About"
    (
      name: tag
      canon: model.canonical tag
    ) for tag in cared?.split(',') or []
  callins: ->
    return unless @puzzle?
    model.CallIns.find
      target_type: 'puzzles'
      target: @puzzle._id
    ,
      sort: {created: 1}
  callin_status: -> callin_types.past_status_message @status, @callin_type
  nickEmail: -> nickEmail @

  unsetcaredabout: ->
    return unless @puzzle
    r = for meta in (model.Puzzles.findOne m for m in @puzzle.feedsInto)
      continue unless meta?
      for tag in meta.tags.cares_about?.value.split(',') or []
        continue if model.getTag @puzzle, tag
        { name: tag, meta: meta.name }
    [].concat r...
    
  metatags: ->
    return unless @puzzle?
    r = for meta in (model.Puzzles.findOne m for m in @puzzle.feedsInto)
      continue unless meta?
      for canon, tag of meta.tags
        continue unless /^meta /i.test tag.name
        {name: tag.name, value: tag.value, meta: meta.name}
    [].concat r...


Template.puzzle.helpers
  data: ->
    r = {}
    puzzle = r.puzzle = model.Puzzles.findOne Session.get 'id'
    round = r.round = model.Rounds.findOne puzzles: puzzle?._id
    r.isMeta = puzzle?.puzzles?
    r.stuck = model.isStuck puzzle
    r.capType = capType puzzle
    return r
  currentViewIs: (view) -> currentViewIs @puzzle, view
  color: -> color @puzzle if @puzzle
  docLoaded: -> Template.instance().docLoaded.get()

Template.puzzle.events 
  'click .bb-go-fullscreen': (e, t) -> $('.bb-puzzleround').get(0)?.requestFullscreen navigationUI: 'hide'

Template.header_breadcrumb_extra_links.helpers
  currentViewIs: (view) -> currentViewIs this, view

Template.puzzle.onCreated ->
  @docLoaded = new ReactiveVar false
  @autorun =>
    if Session.equals 'view', 'doc'
      @docLoaded.set true
      return
    model.Puzzles.findOne(Session.get('id'), {fields: {doc: 1}})
    @docLoaded.set false
  this.autorun =>
    # set page title
    id = Session.get 'id'
    puzzle = model.Puzzles.findOne id
    name = puzzle?.name or id
    $("title").text("#{capType puzzle}: #{name}")
  # presumably we also want to subscribe to the puzzle's chat room
  # and presence information at some point.
  this.autorun =>
    return if settings.BB_SUB_ALL
    id = Session.get 'id'
    return unless id
    @subscribe 'puzzle-by-id', id
    @subscribe 'round-for-puzzle', id
    @subscribe 'puzzles-by-meta', id

Template.puzzle_summon_button.helpers
  stuck: -> model.isStuck this

Template.puzzle_summon_button.events
  "click .bb-summon-btn.stuck": (event, template) ->
    share.confirmationDialog
      message: 'Are you sure you want to cancel this request for help?'
      ok_button: "Yes, this #{model.pretty_collection(Session.get 'type')} is no longer stuck"
      no_button: 'Nevermind, this is still STUCK'
      ok: ->
        Meteor.call 'unsummon',
          type: Session.get 'type'
          object: Session.get 'id'
  "click .bb-summon-btn.unstuck": (event, template) ->
    $('#summon_modal .stuck-at').val('at start')
    $('#summon_modal .stuck-need').val('ideas')
    $('#summon_modal .stuck-other').val('')
    $('#summon_modal .bb-callin-submit').focus()
    $('#summon_modal').modal show: true

Template.puzzle_summon_modal.events
  "click .bb-summon-submit, submit form": (event, template) ->
    event.preventDefault() # don't reload page
    at = template.$('.stuck-at').val()
    need = template.$('.stuck-need').val()
    other = template.$('.stuck-other').val()
    how = "Stuck #{at}"
    if need isnt 'other'
        how += ", need #{need}"
    if other isnt ''
        how += ": #{other}"
    Meteor.call 'summon',
      type: Session.get 'type'
      object: Session.get 'id'
      how: how
    template.$('.modal').modal 'hide'

Template.puzzle_callin_button.events
  "click .bb-callin-btn": (event, template) ->
    $('#callin_modal input:text').val('')
    $('#callin_modal input[type="checkbox"]:checked').val([])
    $('#callin_modal').modal show: true
    $('#callin_modal input:text').focus()

Template.puzzle_callin_modal.onCreated ->
  @type = new ReactiveVar callin_types.ANSWER

Template.puzzle_callin_modal.onRendered ->
  @$("input[name='callin_type'][value='#{@type.get()}']").prop('checked', true)

Template.puzzle_callin_modal.helpers
  type: -> Template.instance().type.get()
  typeIs: (type) -> Template.instance().type.get() is type
  typeName: (type) -> switch (type ? Template.instance().type.get())
    when callin_types.ANSWER then 'Answer'
    when callin_types.INTERACTION_REQUEST then 'Interaction Request'
    when callin_types.MESSAGE_TO_HQ then 'Message to HQ'
    when callin_types.EXPECTED_CALLBACK then 'Expected Callback'
    else ''
  tooltip: (type) -> switch type
    when callin_types.ANSWER then 'The solution to the puzzle. Fingers crossed!'
    when callin_types.INTERACTION_REQUEST then 'An intermediate string that may trigger a skit, physical puzzle, or creative challenge.'
    when callin_types.MESSAGE_TO_HQ then 'Any other reason for contacting HQ, including spending clue currency and reporting an error.'
    when callin_types.EXPECTED_CALLBACK then 'We will be contacted by HQ. No immediate action is required of the oncall.'
    else ''
  callinTypes: -> [
    callin_types.ANSWER,
    callin_types.INTERACTION_REQUEST,
    callin_types.MESSAGE_TO_HQ,
    callin_types.EXPECTED_CALLBACK]

Template.puzzle_callin_modal.events
  'change input[name="callin_type"]': (event, template) ->
    template.type.set event.currentTarget.value
  "click .bb-callin-submit, submit form": (event, template) ->
    event.preventDefault() # don't reload page
    answer = template.$('.bb-callin-answer').val()
    return unless answer
    args =
      target: Session.get 'id'
      answer: answer
      callin_type: template.type.get()
    if template.$('input:checked[value="provided"]').val() is 'provided'
      args.provided = true
    if template.$('input:checked[value="backsolve"]').val() is 'backsolve'
      args.backsolve = true
    Meteor.call "newCallIn", args
    template.$('.modal').modal 'hide'
