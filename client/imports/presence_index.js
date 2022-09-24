/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Presence } from '/lib/imports/collections.coffee';

const presenceIndex = new Map;

const ensure = function(channel) {
  let coll = presenceIndex.get(channel);
  if (coll == null) {
    coll = new Mongo.Collection(null);
    presenceIndex.set(channel, coll);
  }
  return coll;
};

Meteor.startup(() => Presence.find({scope: {$in: ['chat', 'jitsi']}}).observe({
  added(doc) {
    return ensure(doc.room_name).upsert(doc.nick, {
      $min: { joined_timestamp: doc.joined_timestamp
    },
      $max: {
        jitsi: +(doc.scope === 'jitsi'),
        chat: +(doc.scope === 'chat')
      }
    }
    );
  },
  removed(doc) {
    const coll = presenceIndex.get(doc.room_name);
    if (coll == null) { return; }
    coll.update(doc.nick, {
      $min: {
        jitsi: +(doc.scope !== 'jitsi'),
        chat: +(doc.scope !== 'chat')
      }
    }
    );
    return coll.remove({_id: doc.nick, jitsi: 0, chat: 0});
  }}));

export var findByChannel = (channel, query, options) => ensure(channel).find(query, options);
