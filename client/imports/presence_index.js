import { Presence } from "/lib/imports/collections.js";

const presenceIndex = new Map();

function ensure(channel) {
  let coll = presenceIndex.get(channel);
  if (coll == null) {
    coll = new Mongo.Collection(null);
    presenceIndex.set(channel, coll);
  }
  return coll;
}

Meteor.startup(() =>
  Presence.find({ scope: { $in: ["chat", "jitsi"] } }).observe({
    added(doc) {
      ensure(doc.room_name).upsert(doc.nick, {
        $min: { joined_timestamp: doc.joined_timestamp },
        $inc: { [doc.scope]: 1 },
      });
    },
    removed(doc) {
      const coll = presenceIndex.get(doc.room_name);
      if (coll == null) {
        return;
      }
      coll.update(doc.nick, { $inc: { [doc.scope]: -1 } });
      coll.remove({ _id: doc.nick, jitsi: 0, chat: 0 });
    },
  })
);

export var findByChannel = (channel, query, options) =>
  ensure(channel).find(query, options);
