/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './statistics_chart.html';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-dayjs-3';
import PuzzleFeed from './puzzle_feed.coffee';

Template.statistics_chart.onCreated(function() {
  const update = () => this.chart?.update();
  this.puzzleFeed = new PuzzleFeed('created', update);
  return this.solvedFeed = new PuzzleFeed('solved', update);
});

Template.statistics_chart.onRendered(function() {
  this.autorun(() => {
    this.puzzleFeed.observe();
    return this.solvedFeed.observe();
  });
  this.chart = new Chart(this.$('#bb-chart-target > canvas')[0], {
    type: 'line',
    options: {
      animation: {
        duration: 200
      },
      animations: {
        y: {
          from: undefined
        }
      },
      scales: {
        yAxis: {
          beginAtZero: true
        },
        xAxis: {
          type: 'time'
        }
      },
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Puzzles'
        }
      }
    },
    data: {
      datasets: [{
        label: 'Unlocked',
        data: this.puzzleFeed.data,
        spanGaps: true,
        borderColor: 'blue',
        backgroundColor: 'lightblue',
        fill: true,
        order: 1,
        stepped: true
      }, {
        label: 'Solved',
        data: this.solvedFeed.data,
        spanGaps: true,
        borderColor: 'green',
        backgroundColor: 'palegreen',
        fill: true,
        stepped: true
      }
      ]
    }
  });
  this.autorun(() => {
    return this.puzzleFeed.updateNow();
  });
  return this.autorun(() => {
    return this.solvedFeed.updateNow();
  });
});
