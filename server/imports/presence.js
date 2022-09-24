// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let watchPresence;
import canonical from '/lib/imports/canonical.coffee';
import { PRESENCE_KEEPALIVE_MINUTES } from '/lib/imports/constants.coffee';
import { Messages, Presence, Puzzles } from '/lib/imports/collections.coffee';

// look up a real name, if there is one
const maybe_real_name = function(nick) {
  const n = Meteor.users.findOne(canonical(nick));
  return n?.real_name || nick;
};

const common_presence_fields = {
  system: true,
  to: null,
  bodyIsHtml: false
};

class PresenceManager {
  constructor() {
    // Presence
    // ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
    this.interval = Meteor.setInterval(function() {
      const removeBefore = Date.now() - (2*PRESENCE_KEEPALIVE_MINUTES*60*1000);
      return Presence.update(
        {"clients.timestamp": {$lt: removeBefore}}
      ,
        {$pull: {clients: {timestamp: {$lt: removeBefore}}}});
    }
    , 60*1000);

    // generate automatic "<nick> entered <room>" and <nick> left room" messages
    // as the presence set changes
    let initiallySuppressPresence = true;
    this.noclients = Presence.find({clients: []}).observe({
      added(presence) {
        return Presence.remove(presence._id);
      }
    });
    this.joinpart = Presence.find({scope: 'chat'}, {fields: {clients: 0}}).observe({
      added(presence) {
        if (initiallySuppressPresence) { return; }
        if (presence.room_name === 'oplog/0') { return; }
        return Messages.insert({
          nick: presence.nick,
          presence: 'join',
          body: `${maybe_real_name(presence.nick)} joined the room.`,
          room_name: presence.room_name,
          timestamp: presence.joined_timestamp,
          ...common_presence_fields
        });
      },
      removed(presence) {
        if (initiallySuppressPresence) { return; }
        if (presence.room_name === 'oplog/0') { return; }
        return Messages.insert({
          nick: presence.nick,
          presence: 'part',
          body: `${maybe_real_name(presence.nick)} left the room.`,
          room_name: presence.room_name,
          timestamp: Date.now(),
          ...common_presence_fields
        });
      },
      changed(newDoc, oldDoc) {
        if (newDoc.bot) { return; }
        const match = oldDoc.room_name.match(/puzzles\/(.*)/);
        if (match == null) { return; }
        const timeDiff = newDoc.timestamp - oldDoc.timestamp;
        if (timeDiff <= 0) { return; }
        return Puzzles.update({_id: match[1], solved: null},
          {$inc: {solverTime: timeDiff}});
      }
    });
    // turn on presence notifications once initial observation set has been
    // processed. (observe doesn't return on server until initial observation
    // is complete.)
    initiallySuppressPresence = false;
  }

  stop() {
    this.noclients.stop();
    this.joinpart.stop();
    return Meteor.clearInterval(this.interval);
  }
}

export default watchPresence = () => new PresenceManager;
