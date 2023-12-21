import canonical from "./canonical.js";
import { NonEmptyString } from "./match.js";
import { URL } from "meteor/url";

// Global dynamic settings
//  _id: canonical form of name
//  value: Current value of the setting
//  touched: when the setting was changed
//  touched_by: who last changed the setting
export var Settings = new Mongo.Collection("settings");

export var all_settings = {};

class Setting {
  constructor(name, description, default1, matcher, parser) {
    this.name = name;
    this.description = description;
    this.default = default1;
    this.matcher = matcher;
    this.parser = parser;
    this.canon = canonical(this.name);
    all_settings[this.canon] = this;
    if (Meteor.isServer) {
      this.ensure();
    }
    Object.freeze(this);
  }

  // Reactive on client side
  get() {
    try {
      const value = Settings.findOne(this.canon)?.value;
      if (value != null) {
        return this.convert(value);
      }
    } catch (error) {
      console.warn(`get setting ${this.name} failed`, error);
    }
  }

  // Requires login. On server, from non-method code, use impersonating() to
  // pretend to be a user.
  set(value) {
    Meteor.call("changeSetting", this.canon, value);
  }

  // Checks that raw either satisfies the matcher, or is a string that parses to
  // a value that satisfies the matcher.
  // Returns the converted value if so, or raises Match.Error if not.
  convert(raw) {
    if (Match.test(raw, this.matcher)) {
      return raw;
    }
    check(raw, String);
    const conv = this.parser(raw);
    check(conv, this.matcher);
    return conv;
  }

  ensure() {
    Settings.upsert(this.canon, {
      $setOnInsert: {
        value: this.convert(this.default),
        touched: Date.now(),
      },
    });
  }

  watch(callback) {
    return Settings.find(
      { _id: this.canon },
      { fields: { value: 1 } },
    ).observeChanges({
      added(_id, fields) {
        callback(fields.value);
      },
      changed(_id, fields) {
        callback(fields.value);
      },
    });
  }
}

function parse_boolean(x) {
  switch (x) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      throw new Match.Error(`Bad boolean string ${x}`);
  }
}

const url_matcher = Match.Where(function (url) {
  check(url, String);
  if (url.length === 0) {
    return true;
  }
  let u = null;
  try {
    u = new URL(url);
  } catch (error) {
    throw new Match.Error(`Could not parse ${url} as URL`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Match.Error(`Invalid URL protocol ${u.protocol} in URL ${url}`);
  }
  return true;
});

const path_component_matcher = Match.Where((s) => /^[-_a-zA-Z0-9]*$/.test(s));

const id = (x) => x;

export var EmbedPuzzles = new Setting(
  "Embed Puzzles",
  "Allow embedding iframe of puzzles on puzzle page. Disable if hunt site uses X-Frame-Options to forbid embedding.",
  true,
  Boolean,
  parse_boolean,
);

export var UrlSeparator = new Setting(
  "URL Separator",
  "The character used to replace spaces in the puzzle/round URL.",
  "-",
  String,
  id,
);

export var PuzzleUrlPrefix = new Setting(
  "Puzzle URL Prefix",
  "If set, used as the prefix for new puzzles. Otherwise, they must be set manually.",
  "",
  url_matcher,
  id,
);

export var RoundUrlPrefix = new Setting(
  "Round URL Prefix",
  "If set, used as the prefix for new rounds. Otherwise, they must be set manually.",
  "",
  url_matcher,
  id,
);

export var MaximumMemeLength = new Setting(
  "Maximum Meme Length",
  "The maximum length of a message that can be turned into a meme.",
  140,
  Match.Integer,
  parseInt,
);

export var RoleRenewalTime = new Setting(
  "Role Renewal Time",
  "How many minutes you have to renew holding a role (either explicitly or by taking a role action) before it expires.",
  60,
  Match.Integer,
  parseInt,
);

export var StatsCollectionTime = new Setting(
  "Statistics Collection Time",
  "How many minutes between collections of statistics (e.g. solvers online) for projector-mode charts. 0 means don't collect.",
  0,
  Match.Integer,
  parseInt,
);

export var StaticJitsiMeeting = new Setting(
  "Static Jitsi Meeting",
  "The name of the jitsi room to use for the blackboard and logistics page",
  Meteor.isServer
    ? Meteor.settings?.jitsi?.staticRoom ?? process.env.STATIC_JITSI_ROOM ?? ""
    : "",
  path_component_matcher,
  canonical,
);

Object.freeze(all_settings);

Meteor.methods({
  changeSetting(setting_name, raw_value) {
    check(this.userId, NonEmptyString);
    check(setting_name, String);
    const canonical_name = canonical(setting_name);
    const setting = all_settings[canonical_name];
    check(setting, Setting);
    return (
      0 <
      Settings.update(canonical_name, {
        $set: {
          value: setting.convert(raw_value),
          touched: Date.now(),
          touched_by: this.userId,
        },
      })
    );
  },
});
