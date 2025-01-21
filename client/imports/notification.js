import { reactiveLocalStorage } from "/client/imports/storage.js";
import { navigate } from "/client/imports/router.js";
import { registrationPromise } from "/client/imports/serviceworker.js";

const keystring = (k) => `notification.stream.${k}`;

// Chrome for Android only lets you use Notifications via
// ServiceWorkerRegistration, not directly with the Notification class.
// It appears no other browser (that isn't derived from Chrome) is like that.
// Since there's no capability to detect, we have to use user agent.
const isAndroidChrome = () =>
  /Android.*Chrome\/[.0-9]*/.test(navigator.userAgent);

const notificationDefaults = {
  callins: false,
  answers: true,
  announcements: true,
  "new-puzzles": false,
  stuck: false,
  "favorite-mechanics": true,
  "private-messages": true,
};

export var streams = [
  { name: "new-puzzles", label: "New Puzzles" },
  { name: "announcements", label: "Announcements" },
  { name: "callins", label: "Call-Ins" },
  { name: "answers", label: "Answers" },
  { name: "stuck", label: "Stuck Puzzles" },
  { name: "favorite-mechanics", label: "Favorite Mechanics" },
  { name: "private-messages", label: "Private Messages/Mentions" },
];

const countDependency = new Tracker.Dependency();

export function count() {
  countDependency.depend();
  let i = 0;
  for (let stream in notificationDefaults) {
    const def = notificationDefaults[stream];
    if (reactiveLocalStorage.getItem(keystring(stream)) === "true") {
      i += 1;
    }
  }
  return i;
}

export function set(k, v) {
  const ks = keystring(k);
  if (v === undefined) {
    v = notificationDefaults[k];
  }
  const was = reactiveLocalStorage.getItem(ks);
  reactiveLocalStorage.setItem(ks, v);
  if (was !== v) {
    return countDependency.changed();
  }
}

export function get(k) {
  const ks = keystring(k);
  const v = reactiveLocalStorage.getItem(ks);
  if (v == null) {
    return;
  }
  return v === "true";
}

export var granted = () => Session.equals("notifications", "granted");

export function shouldAsk() {
  if (typeof Notification === "undefined" || Notification === null) {
    return false;
  }
  const p = Session.get("notifications");
  return p !== "granted" && p !== "denied";
}

export var ask = () => Notification.requestPermission();

// On android chrome, we clobber this with a version that uses the
// ServiceWorkerRegistration.
export function notify(title, settings) {
  try {
    const n = new Notification(title, settings);
    if (settings.data?.url != null) {
      return (n.onclick = function () {
        navigate(settings.data.url, { trigger: true });
        return window.focus();
      });
    }
  } catch (err) {
    console.log(err.message);
    throw err;
  }
}

function setupNotifications() {
  if (isAndroidChrome()) {
    registrationPromise
      .then(function (reg) {
        navigator.serviceWorker.addEventListener("message", function (msg) {
          if (msg.data.action !== "navigate") {
            return;
          }
          return navigate(msg.data.url, { trigger: true });
        });
        notify = (title, settings) => reg.showNotification(title, settings);
        finishSetupNotifications();
      })
      .catch((error) => Session.set("notifications", "default"));
    return;
  }
  finishSetupNotifications();
}

function finishSetupNotifications() {
  for (let stream in notificationDefaults) {
    const def = notificationDefaults[stream];
    if (get(stream) == null) {
      set(stream, def);
    }
  }
}

Meteor.startup(async function () {
  // Prep notifications
  if (typeof Notification === "undefined" || Notification === null) {
    Session.set("notifications", "denied");
    return;
  }
  const perm = await navigator.permissions.query({name: "notifications"});
  function permCheck () {
    Session.set("notifications", perm.state);
    if (perm.state === "granted") {
      setupNotifications();
    }
  }
  permCheck();
  perm.onchange = permCheck;
});
