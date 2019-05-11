'use strict'

import { nickEmail } from './imports/nickEmail.coffee'

model = share.model # import
settings = share.settings # import

Meteor.startup ->
  if typeof Audio is 'function' # for phantomjs
    newCallInSound = new Audio "sound/new_callin.wav"
  # note that this observe 'leaks'; that's ok, the set of callins is small
  Tracker.autorun ->
    sub = Meteor.subscribe 'callins'
    return unless sub.ready() # reactive, will re-execute when ready
    initial = true
    model.CallIns.find({}).observe
      added: (doc) ->
        return if initial
        console.log 'ding dong'
        unless Session.get 'mute'
          newCallInSound?.play?()
    initial = false

Template.callins.onCreated ->
  this.subscribe 'callins'
  this.subscribe 'quips'
  return if settings.BB_SUB_ALL
  this.subscribe 'all-roundsandpuzzles'

Template.callins.helpers
  callins: ->
    model.CallIns.find {},
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
  vsize: -> share.Splitter.vsize.get()
  vsizePlusHandle: -> +share.Splitter.vsize.get() + 6
  hsize: -> share.Splitter.hsize.get()

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
    return null unless @puzzle? and @puzzle.incorrectAnswers?.length > 0
    attempts = @puzzle.incorrectAnswers[..]
    attempts.sort (a,b) -> a.timestamp - b.timestamp
    attempts[attempts.length - 1]
  hunt_link: -> @puzzle?.link
  solved: -> @puzzle?.solved
  alreadyTried: ->
    for wrong in @puzzle?.incorrectAnswers
      return true if wrong.answer is @answer
    return false
  nickEmail: -> nickEmail @

Template.callin_row.events
  "click .bb-callin-correct": (event, template) ->
     Meteor.call 'correctCallIn', @_id

  "click .bb-callin-incorrect": (event, template) ->
     Meteor.call 'incorrectCallIn', @_id

  "click .bb-callin-cancel": (event, template) ->
     Meteor.call 'cancelCallIn', id: @_id

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

