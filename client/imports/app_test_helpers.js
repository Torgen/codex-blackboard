import { Meteor } from "meteor/meteor";
import { Tracker } from "meteor/tracker";
import denodeify from "denodeify";
import loginWithCodex from "/client/imports/accounts.js";

// Utility -- returns a promise which resolves when all subscriptions are done
export var waitForSubscriptions = (connection = Meteor.connection) =>
  new Promise(function (resolve) {
    let poll = Meteor.setInterval(function () {
      let allReady = true;
      Object.values(connection._subscriptions).forEach(
        ({ id, name, params, ready }) => {
          if (!ready) {
            console.log(
              `Waiting for subscription ${id} -- ${name}(${params.join()})`
            );
            allReady = false;
          }
        }
      );
      if (!allReady) {
        return;
      }
      console.log("all subscriptions were ready.");
      Meteor.clearInterval(poll);
      resolve();
    }, 200);
  });

export async function waitForMethods() {
  await Meteor.noMethodsInFlight;
  await Meteor.applyAsync("wait", [], {
    wait: true,
    returnServerResultPromise: true,
  });
}

// Tracker.afterFlush runs code when all consequent of a tracker based change
//   (such as a route change) have occured. This makes it a promise.
export var afterFlushPromise = denodeify(Tracker.afterFlush);

export var login = denodeify(loginWithCodex);

const _logout = denodeify(Meteor.logout);

export async function logout() {
  await _logout();
  await afterFlushPromise();
}

export var promiseCall = Meteor.callAsync;

export var promiseCallOn = (x, ...a) => x.callAsync(...a);
