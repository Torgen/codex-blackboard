import canonical from "../lib/imports/canonical.js";
import { lat, lng, distance } from "./imports/location.js";
import botuser from "./imports/botuser.js";
import keyword_or_positional from "./imports/keyword_or_positional.js";
import isVisible from "/client/imports/visible.js";

// Geolocation-related utilities

const GEOLOCATION_DISTANCE_THRESHOLD = 10 / 5280; // 10 feet
const GEOLOCATION_NEAR_DISTANCE = 1; // folks within a mile of you are "near"

const updateLocation = (function () {
  let lastnick = null;
  let last = null;
  return function (pos, nick) {
    if (pos == null) {
      return;
    }
    if (nick !== lastnick) {
      last = null;
    }
    if (last != null) {
      if (lat(pos) === lat(last) && lng(pos) === lng(last)) {
        return;
      }
      if (distance(last, pos) < GEOLOCATION_DISTANCE_THRESHOLD) {
        return;
      }
    }
    last = pos;
    lastnick = nick;
    Tracker.nonreactive(() => Meteor.call("locateNick", { location: pos }));
  };
})();

// As long as the user is logged in, stream position updates to server
Tracker.autorun(function () {
  Geolocation.setPaused(!isVisible());
  const nick = Meteor.userId();
  if (nick == null) {
    return;
  }
  const pos = Geolocation.latLng({ enableHighAccuracy: false });
  if (pos == null) {
    return;
  }
  const geojson = {
    type: "Point",
    coordinates: [pos.lng, pos.lat],
  };
  Session.set("position", geojson); // always use most current location client-side
  updateLocation(geojson, nick);
});

function distanceTo(nick) {
  if (!nick) {
    return null;
  }
  const p = Session.get("position");
  if (p == null) {
    return null;
  }
  const n = Meteor.users.findOne(canonical(nick));
  if (n == null || n.located_at == null) {
    return null;
  }
  return distance(n.located_at, p);
}

function isNickNear(nick) {
  if (canonical(nick) === Meteor.userId()) {
    return false;  // You are near yourself, but we don't need to tell you that.
  }
  const dist = distanceTo(nick);
  if (dist == null) {
    return false;
  }
  return dist <= GEOLOCATION_NEAR_DISTANCE;
}

Template.registerHelper("nickNear", function (args) {
  args = keyword_or_positional("nick", args);
  return isNickNear(args.nick);
});

const CODEXBOT_LOCATIONS = [
  "inside your computer",
  "hanging around",
  "solving puzzles",
  "not amused",
  "having fun!",
  "Your Plastic Pal Who's Fun to Be With.",
  "fond of memes",
  "waiting for you humans to find the coin already",
  "muttering about his precious",
];

Template.registerHelper("nickLocation", function (args) {
  args = keyword_or_positional("nick", args);
  if (canonical(args.nick) === Meteor.userId()) {
    return "";
  } // that's me!
  if (args.nick === botuser()._id) {
    const idx = Math.floor(Session.get("currentTime") / (10 * 60 * 1000));
    return ` is ${CODEXBOT_LOCATIONS[idx % CODEXBOT_LOCATIONS.length]}`;
  }
  const d = distanceTo(args.nick);
  if (d == null) {
    return "";
  }
  const feet = d * 5280;
  switch (false) {
    case d <= 5:
      return ` is ${d.toFixed(0)} miles from you`;
    case d <= 0.1:
      return ` is ${d.toFixed(1)} miles from you`;
    case feet <= 5:
      return ` is ${feet.toFixed(0)} feet from you`;
    case feet <= 0.5:
      return ` is ${feet.toFixed(1)} feet from you`;
    default:
      return " is, perhaps, on your lap?";
  }
});
