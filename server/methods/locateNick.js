import {
  ArrayMembers,
  NumberInRange,
  NonEmptyString,
  ObjectWith,
} from "/lib/imports/match.js";

Meteor.methods({
  locateNick(args) {
    check(this.userId, NonEmptyString);
    check(
      args,
      ObjectWith({
        location: {
          type: "Point",
          coordinates: ArrayMembers([
            NumberInRange({ min: -180, max: 180 }),
            NumberInRange({ min: -90, max: 90 }),
          ]),
        },
        timestamp: Match.Optional(Number),
      })
    );
    // the server transfers updates from priv_located* to located* at
    // a throttled rate to prevent N^2 blow up.
    // priv_located_order implements a FIFO queue for updates, but
    // you don't lose your place if you're already in the queue
    const timestamp = Date.now();
    const n = Meteor.users.update(this.userId, {
      $set: {
        priv_located: args.timestamp ?? timestamp,
        priv_located_at: args.location,
      },
      $min: { priv_located_order: timestamp },
    });
    if (n <= 0) {
      throw new Meteor.Error(400, `bad userId: ${this.userId}`);
    }
  },
});
