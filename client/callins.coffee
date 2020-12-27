'use strict'

import { nickEmail } from './imports/nickEmail.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import * as callin_types from '/lib/imports/callin_types.coffee'

model = share.model # import
settings = share.settings # import

Meteor.startup ->
  if typeof Audio is 'function' # for phantomjs
    newCallInSound = new Audio(Meteor._relativeToSiteRootUrl '/sound/new_callin.wav')

  return unless newCallInSound?.play?
  # note that this observe 'leaks'; that's ok, the set of callins is small
  Tracker.autorun ->
    sub = Meteor.subscribe 'callins'
    return unless sub.ready() # reactive, will re-execute when ready
    initial = true
    query =
      status: 'pending'
    unless Session.equals 'currentPage', 'callins'
      query.callin_type = 'answer'
    model.CallIns.find(query).observe
      added: (doc) ->
        return if initial
        console.log 'ding dong'
        return if 'true' is reactiveLocalStorage.getItem 'mute'
        try
          await newCallInSound.play()
        catch err
          console.error err.message, err
    initial = false

Template.callins.onCreated ->
  this.subscribe 'callins'
  this.subscribe 'quips'
  return if settings.BB_SUB_ALL
  this.subscribe 'all-roundsandpuzzles'

Template.callins.helpers
  callins: ->
    model.CallIns.find {status: 'pending'},
      sort: [["created","asc"]]
      transform: (c) ->
        c.puzzle = if c.target then model.Puzzles.findOne(_id: c.target)
        c
  quips: ->
    # We may want to make this a special limited subscription
    # (rather than having to subscribe to all quips)
    model.Quips.find {},
      sort: [["last_used","asc"],["created","asc"]]
      limit: 5
  quipAddUrl: ->
    share.Router.urlFor 'quips', 'new'

Template.callins.onRendered ->
  $("title").text("Answer queue")
  this.clipboard = new Clipboard '.copy-and-go'

Template.callins.onDestroyed ->
  this.clipboard.destroy()

Template.callins.events
  "click .bb-addquip-btn": (event, template) ->
     share.Router.goTo "quips", "new"

Template.callins_quip.events
  "click .bb-quip-next": (event, template) ->
    Meteor.call 'useQuip', id: @_id
  "click .bb-quip-punt": (event, template) ->
    Meteor.call 'useQuip',
      id: @_id
      punted: true
  "click .bb-quip-remove": (event, template) ->
    Meteor.call 'removeQuip', @_id

Template.callin_row.helpers
  lastAttempt: ->
    return null unless @puzzle?
    console.log model.CallIns.findOne {target_type: 'puzzles', target: @puzzle._id, status: 'rejected'}
    model.CallIns.findOne {target_type: 'puzzles', target: @puzzle._id, status: 'rejected'},
      sort: resolved: -1
      limit: 1
      fields: resolved: 1
    ?.resolved
    
  hunt_link: -> @puzzle?.link
  solved: -> @puzzle?.solved
  alreadyTried: ->
    return unless @puzzle?
    model.CallIns.findOne({target_type: 'puzzles', target: @puzzle._id, status: 'rejected', answer: @answer},
      fields: {}
    )?
  callinTypeIs: (type) -> @callin_type is type
  nickEmail: -> nickEmail @

Template.callin_row.events
  "change .bb-submitted-to-hq": (event, template) ->
    checked = !!event.currentTarget.checked
    Meteor.call 'setField',
      type: 'callins'
      object: @_id
      fields:
        submitted_to_hq: checked
        submitted_by: if checked then Meteor.userId() else null

  "click .copy-and-go": (event, template) ->
    Meteor.call 'setField',
      type: 'callins'
      object: @_id
      fields:
        submitted_to_hq: true
        submitted_by: Meteor.userId()

Template.callin_type_dropdown.events
  'click a[data-callin-type]': (event, template) ->
    Meteor.call 'setField',
      type: 'callins'
      object: @_id
      fields:
        callin_type: event.currentTarget.dataset.callinType


Template.callin_resolution_buttons.helpers
  allowsResponse: -> @callin.callin_type isnt callin_types.ANSWER
  allowsIncorrect: -> @callin.callin_type isnt callin_types.EXPECTED_CALLBACK
  accept_message: -> callin_types.accept_message @callin.callin_type
  reject_message: -> callin_types.reject_message @callin.callin_type
  cancel_message: -> callin_types.cancel_message @callin.callin_type

Template.callin_resolution_buttons.events
  "click .bb-callin-correct": (event, template) ->
    response = template.find("input.response")?.value
    if response? and response isnt ''
      Meteor.call 'correctCallIn', @callin._id, response
    else
      Meteor.call 'correctCallIn', @callin._id

  "click .bb-callin-incorrect": (event, template) ->
    response = template.find("input.response")?.value
    if response? and response isnt ''
      Meteor.call 'incorrectCallIn', @callin._id, response
    else
      Meteor.call 'incorrectCallIn', @callin._id

  "click .bb-callin-cancel": (event, template) ->
    Meteor.call 'cancelCallIn', id: @callin._id
