'use strict'

import { MUTE_SOUND_EFFECTS, EXPERT_MODE } from './imports/settings.coffee'
import { CallIns } from '/lib/imports/collections.coffee'
import * as callin_types from '/lib/imports/callin_types.coffee'

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
    CallIns.find(query).observe
      added: (doc) ->
        return if initial
        console.log 'ding dong'
        return if MUTE_SOUND_EFFECTS.get()
        try
          await newCallInSound.play()
        catch err
          console.error err.message, err
    initial = false

Template.callin_copy_and_go.events
  "click .copy-and-go": (event, template) ->
    event.preventDefault()
    url = event.currentTarget.href
    await navigator.clipboard.writeText $(event.currentTarget.dataset.clipboardTarget).text()
    Meteor.call 'setField',
      type: 'callins'
      object: @callin._id
      fields:
        submitted_to_hq: true
        submitted_by: Meteor.userId()
    window.open url, '_blank'

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
