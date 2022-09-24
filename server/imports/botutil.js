// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { callAs } from './impersonate.js';

export var scripts = {};

// helper function: concat regexes
export var rejoin = function(...regs) {
  const last = regs[regs.length - 1];
  const flags = (() => {
    if (last instanceof RegExp) {
    // use the flags of the last regexp, if there are any
    return ( /\/([gimy]*)$/.exec(last.toString()) )?.[1];
  } else if (typeof last === 'object') {
    // use the flags property of the last object parameter
    return regs.pop().flags;
  }
  })();
  return new RegExp( regs.reduce( (acc, r) => acc + (r instanceof RegExp ? r.source : r)
  , '' ), flags ?? '');
};

// regexp for puzzle/round/group name, w/ optional quotes
// don't allow empty strings to be things, that's just confusing
// leading and trailing spaces should not be taken (unless in quotes)
export var thingRE = new RegExp(`(\
\\"(?:[^\\"\\\\]|\\\\\\")+\\"|\
\\'(?:[^\\'\\\\]|\\\\\\')+\\'|\
\\S(?:.*?\\S)?\
)`);

export var strip = function(s) {
  if ((/^[\"\']/.test(s)) && (s[0] === s[s.length-1])) {
    try { return JSON.parse(s); } catch (error) {}
  }
  return s;
};

// helper function
export var objectFromRoom = function(msg) {
  // get puzzle id from room name
  const {
    room
  } = msg.envelope;
  const who = msg.envelope.user.id;
  const [type,id] = room.split('/', 2);
  if ((type === "general") || (type === 'callins')) {
    msg.reply({useful: true}, "You need to tell me which puzzle this is for.");
    msg.finish();
    return;
  }
  if ((type !== 'puzzles') && (type !== 'rounds')) {
    msg.reply({useful: true}, `I don't understand the type: ${type}.`);
    msg.finish();
    return;
  }
  const object = callAs("get", who, type, id);
  if (!object) {
    msg.reply({useful: true}, `Something went wrong.  I can't look up ${room}.`);
    msg.finish();
    return;
  }
  return {type, object};
};

export var puzzleOrThis = function(s, msg) {
  if (s === 'this') { return objectFromRoom(msg); }
  const who = msg.envelope.user.id;
  const p = callAs("getByName", who, {
    name: s,
    optional_type: 'puzzles'
  }
  );
  if (p != null) { return p; }
  msg.reply({useful: true}, `I can't find a puzzle called \"${s}\".`);
  msg.finish();
  return null;
};