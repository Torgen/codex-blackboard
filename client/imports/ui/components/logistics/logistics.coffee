'use strict'
import './logistics.html'
import './logistics.less'
import colorFromThingWithTags from '/client/imports/objectColor.coffee'
import { isStuck } from '/lib/imports/tags.coffee'

Template.logistics.helpers
  metas: ->
    x = []
    for round in share.model.Rounds.find({}, sort: sort_key: 1).fetch()
      for puzzle in round.puzzles
        puz = share.model.Puzzles.findOne _id: puzzle
        x.push puz if puz.puzzles?
    x

Template.logistics_meta.helpers
  color: -> colorFromThingWithTags @
  puzzles: -> @puzzles.map (_id) -> share.model.Puzzles.findOne {_id}
  stuck: isStuck
