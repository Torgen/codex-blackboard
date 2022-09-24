'use strict'

PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle'

export default class PuzzleDrag
  constructor: (puzzle, meta, round, target, clientY, dataTransfer) ->
    @id = puzzle._id
    rect = target.getBoundingClientRect()
    @fromTop = clientY - rect.top
    @fromBottom = rect.bottom - clientY
    @meta = meta?._id
    @round = round?._id
    dataTransfer.setData PUZZLE_MIME_TYPE, @id
    dataTransfer.effectAllowed = 'move'

  dragover: (puzzle, meta, round, target, clientY, dataTransfer) ->
    return false unless dataTransfer.types.includes PUZZLE_MIME_TYPE
    myId = puzzle._id
    if @id is myId
      return true # Drop okay, but nothing to do
    return false unless meta?._id is @meta
    return false unless round?._id is @round
    parent = meta or round
    myIndex = parent.puzzles.indexOf myId
    itsIndex = parent.puzzles.indexOf @id
    diff = itsIndex - myIndex
    rect = target.getBoundingClientRect()
    args = null
    if clientY - rect.top < @fromTop
      return true if diff == -1
      args = before: myId
    else if rect.bottom - clientY < @fromBottom
      return true if diff == 1
      args = after: myId
    else if diff > 1
      args = after: myId
    else if diff < -1
      args = before: myId
    else
      return true
    if meta?
      Meteor.call 'moveWithinMeta', @id, meta._id, args
    else if round?
      Meteor.call 'moveWithinRound', @id, round._id, args
    return true
