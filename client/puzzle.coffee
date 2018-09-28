'use strict'

import color from './imports/objectColor.coffee'

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
  x.push 'puzzle' if puzzle?.link?
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

Template.puzzle_info.helpers
  tag: (name) -> (model.getTag this, name) or ''
  getPuzzle: -> model.Puzzles.findOne this
  caresabout: ->
    cared = model.getTag @puzzle, "Cares About"
    (
      name: tag
      canon: model.canonical tag
    ) for tag in cared?.split(',') or []

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
  vsize: -> share.Splitter.vsize.get()
  vsizePlusHandle: -> +share.Splitter.vsize.get() + 6
  hsize: -> share.Splitter.hsize.get()
  currentViewIs: (view) -> currentViewIs @puzzle, view
  color: -> color @puzzle if @puzzle

Template.header_breadcrumb_extra_links.helpers
  currentViewIs: (view) -> currentViewIs this, view

Template.puzzle.onCreated ->
  $('html').addClass('fullHeight')
  share.chat.startupChat()
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

Template.puzzle.onRendered ->
  $('html').addClass('fullHeight')
Template.puzzle.onDestroyed ->
  $('html').removeClass('fullHeight')
  share.chat.cleanupChat()

Template.puzzle.events
  "mousedown .bb-splitter-handle": (e,t) -> share.Splitter.handleEvent(e,t)

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
    $('#callin_modal input:checked').val([])
    $('#callin_modal').modal show: true
    $('#callin_mdal input:text').focus()

Template.puzzle_callin_modal.events
  "click .bb-callin-submit, submit form": (event, template) ->
    event.preventDefault() # don't reload page
    answer = template.$('.bb-callin-answer').val()
    return unless answer
    backsolve = ''
    if template.$('input:checked[value="provided"]').val() is 'provided'
      backsolve += "provided "
    if template.$('input:checked[value="backsolve"]').val() is 'backsolve'
      backsolve += "backsolved "
    if backsolve
      backsolve += "answer "
    if /answer|backsolve|provided|for|puzzle|^[\'\"]/i.test(answer)
      answer = '"' + answer.replace(/\"/g,'\\"') + '"'
    Meteor.call "newMessage",
      body: "bot: call in #{backsolve}#{answer.toUpperCase()}"
      room_name: "#{Session.get 'type'}/#{Session.get 'id'}"
    template.$('.modal').modal 'hide'
