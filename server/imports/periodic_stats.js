import { PeriodicStats, Presence } from "/lib/imports/collections";
import { StatsCollectionTime } from "/lib/imports/settings";

export default function collectPeriodicStats() {
  let lastInterval, lastCollection, timeout;
  function collect() {
    console.log("Collecting solvers online");
    const numOnline = Presence.find({ scope: "online" }).count();
    lastCollection = Date.now();
    PeriodicStats.insert({
      timestamp: lastCollection,
      stream: "solvers_online",
      value: numOnline,
    });
    timeout = Meteor.setTimeout(collect, lastInterval);
    console.log(`${numOnline} solvers online`);
  }
  const handle = StatsCollectionTime.watch(function (value) {
    console.log(`Collection interval is now ${value} minutes`);
    // Value is in minutes; convert to milliseconds.
    const valueMs = value * 60000;
    if (lastInterval) {
      Meteor.clearTimeout(timeout);
      timeout = null;
    }
    lastInterval = valueMs;
    if (valueMs > 0) {
      if (!lastCollection || lastCollection + valueMs < Date.now()) {
        collect();
      } else {
        timeout = Meteor.setTimeout(
          collect,
          lastCollection + valueMs - Date.now(),
        );
      }
    }
  });
  return {
    stop() {
      handle.stop();
      Meteor.clearTimeout(timeout);
      timeout = null;
    },
  };
}
