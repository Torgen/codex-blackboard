import './fix_puzzle_drive.html'

import { Puzzles } from '/lib/imports/collections.coffee'

Template.fix_puzzle_drive.helpers
  puzzle: -> Puzzles.findOne({_id: @puzzle}, {fields: {drive: 1, drive_status: 1}})

Template.fix_puzzle_drive.events
  'click .bb-fix-drive': (event, template) ->
    event.preventDefault() # keep .bb-editable from being processed!
    event.stopPropagation() # keep .bb-editable from being processed!
    Meteor.call 'fixPuzzleFolder',
      object: @puzzle
      name: Puzzles.findOne({_id: @puzzle}).name
