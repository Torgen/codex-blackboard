// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

import { reactiveLocalStorage } from '/client/imports/storage.coffee';
import Router from '/client/imports/router.coffee';

const keystring = k => `notification.stream.${k}`;

// Chrome for Android only lets you use Notifications via
// ServiceWorkerRegistration, not directly with the Notification class.
// It appears no other browser (that isn't derived from Chrome) is like that.
// Since there's no capability to detect, we have to use user agent.
const isAndroidChrome = () => /Android.*Chrome\/[.0-9]*/.test(navigator.userAgent);

const notificationDefaults = {
  callins: false,
  answers: true,
  announcements: true,
  'new-puzzles': false,
  stuck: false,
  'favorite-mechanics': true,
  'private-messages': true
};

export var streams = [
  {name: 'new-puzzles', label: 'New Puzzles'},
  {name: 'announcements', label: 'Announcements'},
  {name: 'callins', label: "Call-Ins"},
  {name: 'answers', label: "Answers"},
  {name: 'stuck', label: 'Stuck Puzzles'},
  {name: 'favorite-mechanics', label: 'Favorite Mechanics'},
  {name: 'private-messages', label: 'Private Messages/Mentions'}
];

const countDependency = new Tracker.Dependency;

export var count = function() {
  countDependency.depend();
  let i = 0;
  for (let stream in notificationDefaults) {
    const def = notificationDefaults[stream];
    if (reactiveLocalStorage.getItem(keystring(stream)) === "true") {
      i += 1;
    }
  }
  return i;
};

export var set = function(k, v) {
  const ks = keystring(k);
  if (v === undefined) { v = notificationDefaults[k]; }
  const was = reactiveLocalStorage.getItem(ks);
  reactiveLocalStorage.setItem(ks, v);
  if (was !== v) {
    return countDependency.changed();
  }
};

export var get = function(k) {
  const ks = keystring(k);
  const v = reactiveLocalStorage.getItem(ks);
  if (v == null) { return; }
  return v === "true";
};

export var granted = () => Session.equals('notifications', 'granted');

export var shouldAsk = function() {
  if (typeof Notification === 'undefined' || Notification === null) { return false; }
  const p = Session.get('notifications');
  return (p !== 'granted') && (p !== 'denied');
};

export var ask = () => Notification.requestPermission(function(ok) {
  Session.set('notifications', ok);
  if (ok === 'granted') { return setupNotifications(); }
});

// On android chrome, we clobber this with a version that uses the
// ServiceWorkerRegistration.
export var notify = function(title, settings) {
  try {
    const n = new Notification(title, settings);
    if (settings.data?.url != null) {
      return n.onclick = function() {
        Router.navigate(settings.data.url, {trigger: true});
        return window.focus();
      };
    }
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};

var setupNotifications = function() {
  if (isAndroidChrome()) {
    navigator.serviceWorker.register(Meteor._relativeToSiteRootUrl('sw.js')).then(function(reg) {
      navigator.serviceWorker.addEventListener('message', function(msg) {
        if (!Meteor.isProduction) { console.log(msg.data); }
        if (msg.data.action !== 'navigate') { return; }
        return Router.navigate(msg.data.url, {trigger: true});
      });
      notify = (title, settings) => reg.showNotification(title, settings);
      return finishSetupNotifications();
    }).catch(error => Session.set('notifications', 'default'));
    return;
  }
  return finishSetupNotifications();
};

var finishSetupNotifications = () => (() => {
  const result = [];
  for (let stream in notificationDefaults) {
    const def = notificationDefaults[stream];
    if (get(stream) == null) { result.push(set(stream, def)); } else {
      result.push(undefined);
    }
  }
  return result;
})();
  
Meteor.startup(function() {
  // Prep notifications
  if (typeof Notification === 'undefined' || Notification === null) {
    Session.set('notifications', 'denied');
    return;
  }
  Session.set('notifications', Notification.permission);
  if (Notification.permission === 'granted') { return setupNotifications(); }
});