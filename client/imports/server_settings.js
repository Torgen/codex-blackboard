// this is populated on the client based on the server's --settings
const server = Meteor.settings?.public ?? {};

// identify this particular client instance
export var CLIENT_UUID = Random.id();

// used to create gravatars from nicks
export var DEFAULT_HOST = server.defaultHost ?? "codexian.us";

export var TEAM_NAME = server.teamName ?? "Codex";

export var GENERAL_ROOM_NAME = server.chatName ?? "Ringhunters";

export var NAME_PLACEHOLDER = server.namePlaceholder ?? "J. Random Codexian";

export var WHOSE_GITHUB = server.whoseGitHub ?? "cjb";

export var INITIAL_CHAT_LIMIT = server.initialChatLimit ?? 200;

export var CHAT_LIMIT_INCREMENT = server.chatLimitIncrement ?? 100;

// Used to generate video chat links
// No default; if unset, don't generate links.
export var JITSI_SERVER = server.jitsi?.server ?? server.jitsiServer;

// -- Performance settings --

// make fewer people subscribe to ringhunters chat.
export var BB_DISABLE_RINGHUNTERS_HEADER = server.disableRinghunters ?? false;

// disable PMs (more efficient queries if PMs are disabled)
// (PMs are always allows in ringhunters)
export var BB_DISABLE_PM = server.disablePM ?? false;

export var MAPS_API_KEY = server.mapsApiKey;
