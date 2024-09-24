import canonical from "/lib/imports/canonical.js";
import { PRESENCE_KEEPALIVE_MINUTES } from "/lib/imports/constants.js";
import { Messages, Presence, Puzzles } from "/lib/imports/collections.js";

// look up a real name, if there is one
async function maybe_real_name(nick) {
  const n = await Meteor.users.findOneAsync(canonical(nick));
  return n?.real_name || nick;
}

const common_presence_fields = {
  system: true,
  to: null,
  bodyIsHtml: false,
};

class PresenceManager {
  async start() {
    // Presence
    // ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
    this.interval = Meteor.setInterval(async function () {
      const removeBefore =
        Date.now() - 2 * PRESENCE_KEEPALIVE_MINUTES * 60 * 1000;
      await Presence.updateAsync(
        { "clients.timestamp": { $lt: removeBefore } },
        { $pull: { clients: { timestamp: { $lt: removeBefore } } } }
      );
    }, 60 * 1000);

    // generate automatic "<nick> entered <room>" and <nick> left room" messages
    // as the presence set changes
    let initiallySuppressPresence = true;
    this.noclients = await Presence.find({ clients: [] }).observeAsync({
      async added(presence) {
        await Presence.removeAsync(presence._id);
      },
    });
    this.joinpart = await Presence.find(
      { scope: "chat" },
      { fields: { clients: 0 } }
    ).observeAsync({
      async added(presence) {
        if (initiallySuppressPresence) {
          return;
        }
        if (presence.room_name === "oplog/0") {
          return;
        }
        await Messages.insertAsync({
          nick: presence.nick,
          presence: "join",
          body: `${await maybe_real_name(presence.nick)} joined the room.`,
          room_name: presence.room_name,
          timestamp: presence.joined_timestamp,
          ...common_presence_fields,
        });
      },
      async removed(presence) {
        if (initiallySuppressPresence) {
          return;
        }
        if (presence.room_name === "oplog/0") {
          return;
        }
        await Messages.insertAsync({
          nick: presence.nick,
          presence: "part",
          body: `${await maybe_real_name(presence.nick)} left the room.`,
          room_name: presence.room_name,
          timestamp: Date.now(),
          ...common_presence_fields,
        });
      },
      async changed(newDoc, oldDoc) {
        if (newDoc.bot) {
          return;
        }
        const match = oldDoc.room_name.match(/puzzles\/(.*)/);
        if (match == null) {
          return;
        }
        const timeDiff = newDoc.timestamp - oldDoc.timestamp;
        if (timeDiff <= 0) {
          return;
        }
        await Puzzles.updateAsync(
          { _id: match[1], solved: null },
          { $inc: { solverTime: timeDiff } }
        );
      },
    });
    // turn on presence notifications once initial observation set has been
    // processed. (observe doesn't return on server until initial observation
    // is complete.)
    initiallySuppressPresence = false;
    return this;
  }

  stop() {
    this.noclients.stop();
    this.joinpart.stop();
    Meteor.clearInterval(this.interval);
  }
}

export default () => new PresenceManager().start();
