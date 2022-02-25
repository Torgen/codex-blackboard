import './statistics_page.html'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'

class PuzzleFeed
  constructor: (@field, @update) ->
    @data = []
    @hasNow = new ReactiveVar false

  updateNow: ->
    time = Session.get 'currentTime'
    if @hasNow.get()
      if time > @data.at(-1).x
        @data.at(-1).x = time
        @update()
    else
      unless @data.length and @data.at(-1).x > time
        @hasNow.set true
        @data.push {x: time, y: @data.length}
        @update()

  observe: ->
    share.model.Puzzles.find({[@field]: $ne: null}, {fields: {[@field]: 1}, sort: {[@field]: 1}}).observe
      addedAt: (doc, ix) =>
        @data.splice ix, 0, {x: doc[@field], y: ix + 1}
        while ++ix < @data.length
          @data[ix].y++
        Tracker.nonreactive =>
          if @hasNow.get() and @data.length > 1 and @data.at(-2).x > @data.at(-1).x
            @hasNow.set false
            @data.pop()
        @update()
      changedAt: (oldDoc, newDoc, ix) =>
        @data[ix].x = newDoc[@field]
        @update()
      removedAt: (doc, ix) =>
        @data.splice ix, 1
        while ++ix < @data.length
          @data[ix].y--
        @update()

Template.statistics_page.onCreated ->
  @autorun =>
    @subscribe 'statistics', 'puzzles'
    @subscribe 'statistics', 'solved_puzzles'
  update = => @chart?.update()
  @puzzleFeed = new PuzzleFeed 'created', update
  @solvedFeed = new PuzzleFeed 'solved', update

Template.statistics_page.onRendered ->
  @autorun =>
    @puzzleFeed.observe()
    @solvedFeed.observe()
  @chart = new Chart @$('#bb-chart-target > canvas')[0],
    type: 'line'
    options:
      animation:
        duration: 200
      animations:
        y:
          from: undefined
      scales:
        yAxis:
          beginAtZero: true
        xAxis:
          type: 'time'
      maintainAspectRatio: false
      plugins:
        title:
          display: true
          text: 'Puzzles'
    data:
      datasets: [{
        label: 'Unlocked'
        data: @puzzleFeed.data
        spanGaps: true
        borderColor: 'blue'
        backgroundColor: 'lightblue'
        fill: true
        order: 1
        stepped: true
      }, {
        label: 'Solved'
        data: @solvedFeed.data
        spanGaps: true
        borderColor: 'green'
        backgroundColor: 'palegreen'
        fill: true
        stepped: true
      }
      ]
  @autorun =>
    @puzzleFeed.updateNow()
  @autorun =>
    @solvedFeed.updateNow()
