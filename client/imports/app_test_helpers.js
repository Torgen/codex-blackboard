import { Meteor } from "meteor/meteor";
import { Tracker } from "meteor/tracker";
import { DDP } from "meteor/ddp-client";
import denodeify from "denodeify";
import loginWithCodex from "/client/imports/accounts.js";

// Utility -- returns a promise which resolves when all subscriptions are done
export var waitForSubscriptions = () =>
  new Promise(function (resolve) {
    let poll = Meteor.setInterval(function () {
      if (DDP._allSubscriptionsReady()) {
        Meteor.clearInterval(poll);
        resolve();
      }
    }, 200);
  });

export async function waitForMethods () {
  await Meteor.noMethodsInFlight;
  await Meteor.applyAsync('wait', [], {wait: true});
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
