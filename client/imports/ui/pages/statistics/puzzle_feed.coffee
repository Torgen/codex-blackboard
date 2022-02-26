export default class PuzzleFeed
  constructor: (@field, @update) ->
    @data = []
    @hasNow = new ReactiveVar false

  updateNow: ->
    @update() if @_updateNow()

  _updateNow: ->
    time = Session.get 'currentTime'
    if @hasNow.get()
      if time > @data.at(-1).x
        @data.at(-1).x = time
        return true
    else
      unless @data.length and @data.at(-1).x > time
        @hasNow.set true
        @data.push {x: time, y: @data.length}
        return true
    return false

  addedAt: (doc, ix) -> 
    @data.splice ix, 0, {x: doc[@field], y: ix + 1}
    while ++ix < @data.length
      @data[ix].y++
    Tracker.nonreactive =>
      if @hasNow.get() and @data.length > 1 and @data.at(-2).x > @data.at(-1).x
        @hasNow.set false
        @data.pop()
    @update()

  changedAt: (newDoc, oldDoc, ix) -> 
    @data[ix].x = newDoc[@field]
    Tracker.nonreactive =>
      if @hasNow.get() and ix is @data.length - 2 and @data.at(-2).x > @data.at(-1).x
        @hasNow.set false
        @data.pop()
    @update()

  removedAt: (doc, ix) -> 
    @data.splice ix, 1
    while ++ix < @data.length
      @data[ix].y--
    Tracker.nonreactive => @_updateNow()
    @update()

  observe: ->
    share.model.Puzzles.find({[@field]: $ne: null}, {fields: {[@field]: 1}, sort: {[@field]: 1}}).observe
      addedAt: @addedAt.bind @
      changedAt: @changedAt.bind @
      removedAt: removedAt.bind @
