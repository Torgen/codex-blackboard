import "./statistics_chart.html";
import Chart from "chart.js/auto";
import "chartjs-adapter-dayjs-3";
import PuzzleFeed from "./puzzle_feed.js";
import { PeriodicStats } from "/lib/imports/collections.js";

function allSolversOnline() {
  return PeriodicStats.find(
    { stream: "solvers_online" },
    { sort: { timestamp: "asc" }, fields: { timestamp: 1, value: 1 } }
  ).map(function ({ timestamp, value }) {
    return { x: timestamp, y: value };
  });
}

Template.statistics_chart.onCreated(function () {
  const update = (this.update = () => this.chart?.update());
  this.puzzleFeed = new PuzzleFeed("created", update);
  this.solvedFeed = new PuzzleFeed("solved", update);
  this.autorun(() => (this.statsSub = this.subscribe("periodic-stats")));
});

Template.statistics_chart.onRendered(function () {
  const solvers = [];
  let initial = true;
  this.autorun((computation) => {
    if (!this.statsSub.ready()) {
      return;
    }
    solvers.push(...allSolversOnline());
    initial = false;
    this.update();
    computation.stop();
  });
  this.autorun(() => {
    PeriodicStats.find(
      { stream: "solvers_online" },
      { sort: { timestamp: "asc" }, fields: { timestamp: 1, value: 1 } }
    ).observeChanges({
      added: (_id, { timestamp, value }) => {
        if (initial) {
          return;
        }
        if (!solvers.length || timestamp > solvers.at(-1).x) {
          solvers.push({ x: timestamp, y: value });
        } else {
          Tracker.nonreactive(() =>
            solvers.splice(0, solvers.length, ...allSolversOnline())
          );
        }
        this.update();
      },
    });
  });
  this.autorun(() => {
    this.puzzleFeed.observe();
    this.solvedFeed.observe();
  });
  const ticks = {
    callback: function (value) {
      if (value % 1 === 0) {
        return value;
      }
    },
  };
  this.chart = new Chart(this.$("#bb-chart-target > canvas")[0], {
    type: "line",
    options: {
      animation: {
        duration: 200,
      },
      animations: {
        y: {
          from: undefined,
        },
      },
      scales: {
        yPuzzles: {
          type: "linear",
          beginAtZero: true,
          position: "left",
          title: { text: "Puzzles", display: true },
          ticks,
        },
        yPeople: {
          type: "linear",
          beginAtZero: true,
          position: "right",
          title: { text: "People", display: true },
          ticks,
        },
        xAxis: {
          type: "time",
        },
      },
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Statistics",
        },
        legend: {
          labels: {
            sort: function (a, b) {
              return b.datasetIndex - a.datasetIndex;
            },
          },
        },
      },
    },
    data: {
      datasets: [
        {
          label: "Online",
          data: solvers,
          spanGaps: true,
          borderColor: "black",
          yAxisID: "yPeople",
        },
        {
          label: "Solved",
          data: this.solvedFeed.data,
          spanGaps: true,
          borderColor: "green",
          backgroundColor: "palegreen",
          fill: true,
          stepped: true,
          yAxisID: "yPuzzles",
        },
        {
          label: "Unlocked",
          data: this.puzzleFeed.data,
          spanGaps: true,
          borderColor: "blue",
          backgroundColor: "lightblue",
          fill: true,
          stepped: true,
          yAxisID: "yPuzzles",
        },
      ],
    },
  });
  this.autorun(() => {
    this.puzzleFeed.updateNow();
  });
  this.autorun(() => {
    this.solvedFeed.updateNow();
  });
});
