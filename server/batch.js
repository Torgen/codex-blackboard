import watchPresence from "./imports/presence.js";
import { RoleManager } from "./imports/roles.js";
import { DO_BATCH_PROCESSING } from "/server/imports/batch.js";
import collectPeriodicStats from "/server/imports/periodic_stats.js";

if (DO_BATCH_PROCESSING) {
  // Does various fixups of the collections.
  // Was in lib/model.coffee, but that meant it was loaded on the client even
  // though it could never run there.

  // helper function: like _.throttle, but always ensures `wait` of idle time
  // between invocations.  This ensures that we stay chill even if a single
  // execution of the function starts to exceed `wait`.
  function throttle(func, wait = 0) {
    let [context, args, running, pending] = [null, null, false, false];
    const later = function () {
      if (pending) {
        run();
      } else {
        running = false;
      }
    };
    var run = async function () {
      [running, pending] = [true, false];
      try {
        await func.apply(context, args);
      } catch (error) {}
      // Note that the timeout doesn't start until the function has completed.
      Meteor.setTimeout(later, wait);
    };
    return function (...a) {
      if (pending) {
        return;
      }
      [context, args] = [this, a];
      if (running) {
        pending = true;
      } else {
        running = true;
        Meteor.setTimeout(run, 0);
      }
    };
  }

  // Nicks: synchronize priv_located* with located* at a throttled rate.
  // order by priv_located_order, which we'll clear when we apply the update
  // this ensures nobody gets starved for updates
  // limit to 10 location updates/minute
  const LOCATION_BATCH_SIZE = 10;
  const LOCATION_THROTTLE = (Meteor.isAppTest ? 5 : 60) * 1000;
  const runBatch = () =>
    Meteor.users
      .find(
        {
          priv_located_order: { $exists: true, $ne: null },
        },
        {
          sort: [["priv_located_order", "asc"]],
          limit: LOCATION_BATCH_SIZE,
        }
      )
      .forEachAsync(async function (n, i) {
        console.log(`Updating location for ${n._id} (${i})`);
        await Meteor.users.updateAsync(n._id, {
          $set: {
            located: n.priv_located,
            located_at: n.priv_located_at,
          },
          $unset: { priv_located_order: "" },
        });
      });
  const maybeRunBatch = throttle(runBatch, LOCATION_THROTTLE);
  Meteor.startup(async () =>
    await Meteor.users
      .find(
        {
          priv_located_order: { $exists: true, $ne: null },
        },
        {
          fields: { priv_located_order: 1 },
        }
      )
      .observeChangesAsync({
        added(id, fields) {
          maybeRunBatch();
        },
        // also run batch on removed: batch size might not have been big enough
        removed(id) {
          maybeRunBatch();
        },
      })
  );

  Meteor.startup(async () => await watchPresence());

  const roleManager = new RoleManager();
  Meteor.startup(async () => await roleManager.start());

  Meteor.startup(async () => await collectPeriodicStats());
}
