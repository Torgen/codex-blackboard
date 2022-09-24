import './statistics_chart.html'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-dayjs-3'
import PuzzleFeed from './puzzle_feed.coffee'

Template.statistics_chart.onCreated ->
  update = => @chart?.update()
  @puzzleFeed = new PuzzleFeed 'created', update
  @solvedFeed = new PuzzleFeed 'solved', update

Template.statistics_chart.onRendered ->
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
