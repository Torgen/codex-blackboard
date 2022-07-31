'use strict'
import './logistics.html'
import './logistics.less'
import { findByChannel } from '/client/imports/presence_index.coffee'
import colorFromThingWithTags from '/client/imports/objectColor.coffee'
import { isStuck } from '/lib/imports/tags.coffee'

Template.logistics.onCreated ->
  Session.set 'topRight', 'logistics_topright_panel'
  @autorun =>
    @subscribe 'all-presence'

Template.logistics.onRendered ->
  $("title").text("Logistics")

Template.logistics.helpers
  rounds: ->
    c = share.model.Rounds.find({}, sort: sort_key: 1)
    console.log c.fetch()
    c
  metas: (round) ->
    x = []
    for puzzle in round.puzzles
      puz = share.model.Puzzles.findOne _id: puzzle
      x.push puz if puz.puzzles? or puz.feedsInto.length is 0
    x

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
