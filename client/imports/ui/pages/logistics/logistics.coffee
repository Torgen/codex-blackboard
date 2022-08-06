'use strict'
import './logistics.html'
import './logistics.less'
import '/client/imports/ui/components/create_object/create_object.coffee'
import { findByChannel } from '/client/imports/presence_index.coffee'
import colorFromThingWithTags from '/client/imports/objectColor.coffee'
import { isStuck } from '/lib/imports/tags.coffee'

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

Template.logistics.helpers
  rounds: ->
    c = share.model.Rounds.find({}, sort: sort_key: 1)
    console.log c.fetch()
    c
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

Template.logistics_puzzle.helpers
  stuck: isStuck

Template.logistics_puzzle_events.helpers
  soonest_ending_current_event: ->
    now = Session.get 'currentTime'
    share.model.CalendarEvents.findOne({puzzle: @_id, start: {$lt: now}, end: {$gt: now}}, {sort: end: -1})
  next_future_event: ->
    now = Session.get 'currentTime'
    share.model.CalendarEvents.findOne({puzzle: @_id, start: {$gt: now}}, {sort: start: 1})
  no_events: ->
    share.model.CalendarEvents.find({puzzle: @_id}).count() is 0

Template.logistics_meta.helpers
  color: -> colorFromThingWithTags @meta
  puzzles: -> @meta.puzzles.map (_id) -> share.model.Puzzles.findOne {_id}
  stuck: isStuck

Template.logistics_puzzle_presence.helpers
  presenceForScope: (scope) ->
    return findByChannel("puzzles/#{@_id}", {[scope]: 1}, {fields: [scope]: 1}).count()
