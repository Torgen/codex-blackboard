'use strict'
import './logistics.html'
import './logistics.less'
import colorFromThingWithTags from '/client/imports/objectColor.coffee'
import { isStuck } from '/lib/imports/tags.coffee'

Template.logistics.onRendered ->
  $("title").text("Logistics")
  console.log 'setting topright'
  Session.set 'topRight', 'logistics_topright_panel'

Template.logistics.helpers
  rounds: ->
    c = share.model.Rounds.find({}, sort: sort_key: 1)
    console.log c.fetch()
    c
  metas: (round) ->
    x = []
    for puzzle in round.puzzles
      puz = share.model.Puzzles.findOne _id: puzzle
      x.push puz if puz.puzzles?
    x

Template.logistics_meta.helpers
  color: -> colorFromThingWithTags @meta
  puzzles: -> @meta.puzzles.map (_id) -> share.model.Puzzles.findOne {_id}
  stuck: isStuck
  class: (puzzle) ->
    if puzzle.solved?
      'solved'
    else if isStuck puzzle
      'stuck'
    else ''
