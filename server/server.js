import { createHmac } from "crypto";
import canonical from "/lib/imports/canonical.js";
import { PRESENCE_KEEPALIVE_MINUTES } from "/lib/imports/constants.js";
import {
  Calendar,
  CalendarEvents,
  CallIns,
  JITSI_JWT_COLLECTION_NAME,
  LastRead,
  Messages,
  Polls,
  Presence,
  Puzzles,
  Roles,
  Rounds,
  PeriodicStats,
  collection,
} from "/lib/imports/collections.js";
import {
  gravatarUrl,
  hashFromNickObject,
  nickAndName,
} from "/lib/imports/nickEmail.js";
import { Settings } from "/lib/imports/settings.js";
import { JITSI_SERVER } from "/lib/imports/server_settings.js";
import { NonEmptyString } from "/lib/imports/match.js";

const DEBUG = !Meteor.isProduction;

function puzzleQuery(query) {
  return Puzzles.find(query, {
    fields: {
      name: 1,
      canon: 1,
      link: 1,
      created: 1,
      created_by: 1,
      touched: 1,
      touched_by: 1,
      solved: 1,
      solved_by: 1,
      tags: 1,
      drive: 1,
      spreadsheet: 1,
      doc: 1,
      drive_touched: 1,
      drive_status: 1,
      drive_error_message: 1,
      [`favorites.${this.userId}`]: 1,
      mechanics: 1,
      puzzles: 1,
      order_by: 1,
      feedsInto: 1,
      answers: 1,
      last_partial_answer: 1,
    },
  });
}

const loginRequired = (f) =>
  function () {
    if (!this.userId) {
      return this.ready();
    }
    this.puzzleQuery = puzzleQuery;
    return f.apply(this, arguments);
  };

/*
// hack! log subscriptions so we can see what's going on server-side
const oldPublish = Meteor.publish;
Meteor.publish = function (name, func) {
  const func2 = function () {
    console.log("client subscribed to", name, arguments);
    return func.apply(this, arguments);
  };
  return publish.call(Meteor, name, func2);
}
*/

Meteor.publish(
  "all-roundsandpuzzles",
  loginRequired(function () {
    return [Rounds.find(), this.puzzleQuery({})];
  })
);

Meteor.publish(
  "solved-puzzle-time",
  loginRequired(() =>
    Puzzles.find({ solved: { $exists: true } }, { fields: { solverTime: 1 } })
  )
);

// Login not required for this because it's needed for nick autocomplete.
Meteor.publish(null, () =>
  Meteor.users.find(
    {},
    {
      fields: {
        priv_located: 0,
        priv_located_at: 0,
        priv_located_order: 0,
        located: 0,
        located_at: 0,
        services: 0,
        favorite_mechanics: 0,
      },
    }
  )
);

// Login required for this since it returns you.
Meteor.publish(
  null,
  loginRequired(function () {
    return Meteor.users.find(this.userId, {
      fields: {
        services: 0,
        priv_located_order: 0,
      },
    });
  })
);

// Login required for this since it includes location
Meteor.publish(
  null,
  loginRequired(() =>
    Meteor.users.find(
      {},
      {
        fields: {
          located: 1,
          located_at: 1,
        },
      }
    )
  )
);

Meteor.publish(
  null,
  loginRequired(async function () {
    const handle = await Presence.find(
      { room_name: null, scope: "online" },
      { nick: 1 }
    ).observeAsync({
      added: ({ nick }) => {
        this.added("users", nick, { online: true });
      },
      removed: ({ nick }) => {
        this.removed("users", nick);
      },
    });
    this.onStop(() => handle.stop());
    this.ready();
  })
);

// Private messages to you
Meteor.publish(
  null,
  loginRequired(function () {
    return Messages.find({ to: this.userId, deleted: { $ne: true } });
  })
);
// Messages that mention you
Meteor.publish(
  null,
  loginRequired(function () {
    return Messages.find({ mention: this.userId, deleted: { $ne: true } });
  })
);

// Calendar events
Meteor.publish(
  null,
  loginRequired(() => [
    Calendar.find({}, { fields: { _id: 1 } }),
    CalendarEvents.find(),
  ])
);

Meteor.publish(
  "announcements-since",
  loginRequired((since) =>
    Messages.find({
      announced_at: { $gt: since },
      deleted: { $ne: true },
    })
  )
);

// Roles
Meteor.publish(
  null,
  loginRequired(() => Roles.find({}, { fields: { holder: 1, claimed_at: 1 } }))
);

Meteor.publish(
  null,
  loginRequired(function () {
    return Roles.find(
      { holder: this.userId },
      { fields: { renewed_at: 1, expires_at: 1 } }
    );
  })
);

// Share one map among all listeners
await (async function () {
  const handles = new Set();
  const holders = new Map();
  function addHolder(role, holder) {
    let held = holders.get(holder);
    if (held != null) {
      held.add(role);
      for (let h of handles) {
        h.changed("users", holder, { roles: [...held] });
      }
    } else {
      held = new Set([role]);
      holders.set(holder, held);
      for (let h of handles) {
        h.added("users", holder, { roles: [...held] });
      }
    }
  }
  function removeHolder(role, holder) {
    const held = holders.get(holder);
    held.delete(role);
    if (held.size === 0) {
      holders.delete(holder);
      for (let h of handles) {
        h.removed("users", holder);
      }
    } else {
      for (let h of handles) {
        h.changed("users", holder, { roles: [...held] });
      }
    }
  }

  const handle = await Roles.find({}, { fields: { holder: 1 } }).observeAsync({
    added({ _id, holder }) {
      addHolder(_id, holder);
    },
    changed({ _id, holder: newHolder }, { holder: oldHolder }) {
      removeHolder(_id, oldHolder);
      addHolder(_id, newHolder);
    },
    removed({ _id, holder }) {
      removeHolder(_id, holder);
    },
  });

  Meteor.publish(
    null,
    loginRequired(function () {
      handles.add(this);
      for (let [holder, roles] of holders.entries()) {
        this.added("users", holder, { roles: [...roles] });
      }
      this.onStop(function () {
        handles.delete(this);
      });
      this.ready();
    })
  );
})();

// Your presence in all rooms, with _id changed to room_name.
Meteor.publish(
  null,
  loginRequired(async function () {
    const idToRoom = new Map();
    const handle = await LastRead.find({
      nick: this.userId,
    }).observeChangesAsync({
      added: (id, fields) => {
        idToRoom.set(id, fields.room_name);
        this.added("lastread", fields.room_name, fields);
      },
      changed: (id, { timestamp }) => {
        if (timestamp == null) {
          return;
        }
        // There's no way to change the room name or nick of an existing lastread entry.
        this.changed("lastread", idToRoom.get(id), { timestamp });
      },
    });
    this.onStop(() => handle.stop());
    this.ready();
  })
);

Meteor.publish(
  "all-presence",
  loginRequired(() =>
    // strip out unnecessary fields from presence to avoid wasted updates to clients
    Presence.find(
      { room_name: { $ne: null }, scope: { $in: ["jitsi", "chat"] } },
      {
        fields: {
          timestamp: 0,
          clients: 0,
        },
      }
    )
  )
);
Meteor.publish(
  "presence-for-room",
  loginRequired((room_name) =>
    Presence.find(
      { room_name, scope: { $in: ["chat", "jitsi", "typing"] } },
      {
        fields: {
          timestamp: 0,
          clients: 0,
        },
      }
    )
  )
);

async function registerPresence(room_name, scope) {
  const subscription_id = Random.id();
  /* istanbul ignore else */
  if (DEBUG) {
    console.log(
      `${
        this.userId
      } subscribing to ${scope}:${room_name} at ${Date.now()}, id ${
        this.connection.id
      }:${subscription_id}`
    );
  }
  const keepalive = async () => {
    const now = Date.now();
    await Presence.upsertAsync(
      { nick: this.userId, room_name, scope },
      {
        $setOnInsert: {
          joined_timestamp: now,
        },
        $max: { timestamp: now },
        $push: {
          clients: {
            connection_id: this.connection.id,
            subscription_id,
            timestamp: now,
          },
        },
      }
    );
    await Presence.updateAsync(
      { nick: this.userId, room_name, scope },
      {
        $pull: {
          clients: {
            connection_id: this.connection.id,
            subscription_id,
            timestamp: { $lt: now },
          },
        },
      }
    );
  };
  await keepalive();
  const interval = Meteor.setInterval(
    keepalive,
    PRESENCE_KEEPALIVE_MINUTES * 60 * 1000
  );
  this.onStop(async () => {
    /* istanbul ignore else */
    if (DEBUG) {
      console.log(
        `${this.userId} unsubscribing from ${scope}:${room_name}, id ${this.connection.id}:${subscription_id}`
      );
    }
    Meteor.clearInterval(interval);
    const now = Date.now();
    const clear = async () => {
      await Presence.updateAsync(
        { nick: this.userId, room_name, scope },
        {
          $max: { timestamp: now },
          $pull: {
            clients: {
              connection_id: this.connection.id,
              subscription_id,
            },
          },
        }
      );
    };
    if (scope === "typing") {
      await clear();
    } else {
      Meteor.setTimeout(clear, 2000);
    }
  });
  this.ready();
}

Meteor.publish(
  "register-presence",
  loginRequired(async function (room_name, scope) {
    check(room_name, NonEmptyString);
    check(scope, NonEmptyString);
    await registerPresence.call(this, room_name, scope);
  })
);
Meteor.publish(
  null,
  loginRequired(async function () {
    await registerPresence.call(this, null, "online");
  })
);

Meteor.publish(
  null,
  loginRequired(() => Settings.find())
);

Meteor.publish(
  "last-puzzle-room-message",
  loginRequired(async function (puzzle_id) {
    check(puzzle_id, NonEmptyString);
    this.added("puzzles", puzzle_id, {});
    const lastChat = await Messages.find(
      {
        room_name: `puzzles/${puzzle_id}`,
        $or: [{ to: null }, { to: this.userId }, { nick: this.userId }],
        deleted: { $ne: true },
        presence: null,
      },
      {
        fields: { timestamp: 1 },
        sort: { timestamp: -1 },
        limit: 1,
      }
    ).observeAsync({
      added: (doc) =>
        this.changed("puzzles", puzzle_id, {
          last_message_timestamp: doc.timestamp,
        }),
    });
    const lastReadCallback = (doc) =>
      this.changed("puzzles", puzzle_id, {
        last_read_timestamp: doc.timestamp,
      });
    const lastRead = await LastRead.find({
      room_name: `puzzles/${puzzle_id}`,
      nick: this.userId,
    }).observeAsync({
      added: lastReadCallback,
      changed: lastReadCallback,
    });
    this.onStop(function () {
      lastChat.stop();
      lastRead.stop();
    });
    this.ready();
  })
);

// limit site traffic by only pushing out changes relevant to a certain
// round or puzzle
Meteor.publish(
  "callins-by-puzzle",
  loginRequired((id) => CallIns.find({ target_type: "puzzles", target: id }))
);

// get recent messages
Meteor.publish(
  "recent-messages",
  loginRequired(async function (room_name, limit) {
    const handle = await Messages.find(
      {
        room_name,
        $or: [{ to: null }, { to: this.userId }, { nick: this.userId }],
        deleted: { $ne: true },
      },
      {
        sort: [["timestamp", "desc"]],
        limit,
      }
    ).observeChangesAsync({
      added: (id, fields) => {
        this.added("messages", id, {
          ...fields,
          from_chat_subscription: true,
        });
      },
      changed: (id, fields) => {
        this.changed("messages", id, fields);
      },
      removed: (id) => {
        this.removed("messages", id);
      },
    });
    this.onStop(() => handle.stop());
    this.ready();
  })
);

// Special subscription for the recent chats header because it ignores system
// and presence messages and anything with an HTML body.
Meteor.publish(
  "recent-header-messages",
  loginRequired(function () {
    return Messages.find(
      {
        system: { $ne: true },
        bodyIsHtml: { $ne: true },
        deleted: { $ne: true },
        header_ignore: { $ne: true },
        room_name: "general/0",
        $or: [{ to: null }, { nick: this.userId }],
      },
      {
        sort: [["timestamp", "desc"]],
        limit: 2,
      }
    );
  })
);

// Special subscription for desktop notifications
Meteor.publish(
  "oplogs-since",
  loginRequired((since) =>
    Messages.find({
      room_name: "oplog/0",
      timestamp: { $gt: since },
    })
  )
);

Meteor.publish(
  "starred-messages",
  loginRequired((room_name) =>
    Messages.find(
      { room_name, starred: true, deleted: { $ne: true } },
      { sort: [["timestamp", "asc"]] }
    )
  )
);

Meteor.publish(
  "pending-callins",
  loginRequired(() =>
    CallIns.find({ status: "pending" }, { sort: [["created", "asc"]] })
  )
);

Meteor.publish(
  "periodic-stats",
  loginRequired(() => PeriodicStats.find())
);

// synthetic 'all-names' collection which maps ids to type/name/canon
Meteor.publish(
  null,
  loginRequired(async function () {
    const self = this;
    const handles = await Promise.all(
      ["rounds", "puzzles"].map((type) =>
        collection(type)
          .find({})
          .observeAsync({
            added(doc) {
              self.added("names", doc._id, {
                type,
                name: doc.name,
                canon: canonical(doc.name),
              });
            },
            removed(doc) {
              self.removed("names", doc._id);
            },
            changed(doc, olddoc) {
              if (doc.name === olddoc.name) {
                return;
              }
              self.changed("names", doc._id, {
                name: doc.name,
                canon: canonical(doc.name),
              });
            },
          })
      )
    );
    // observe only returns after initial added callbacks have run.  So now
    // mark the subscription as ready
    self.ready();
    // stop observing the various cursors when client unsubs
    self.onStop(() => handles.map((h) => h.stop()));
  })
);

Meteor.publish(
  "poll",
  loginRequired((id) => Polls.find({ _id: id }))
);

const JWT_HEADER = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString(
  "base64url"
);
const JITSI_APP_NAME =
  Meteor.settings?.jitsi?.appName ?? process.env.JITSI_APP_NAME ?? null;
const JITSI_SHARED_SECRET =
  Meteor.settings?.jitsi?.sharedSecret ??
  process.env.JITSI_SHARED_SECRET ??
  null;

Meteor.publish(
  "jitsi-jwt",
  loginRequired(async function (roomName) {
    check(roomName, String);
    if (!JITSI_APP_NAME || !JITSI_SHARED_SECRET) {
      this.added(JITSI_JWT_COLLECTION_NAME, roomName, {});
      this.ready();
      return;
    }
    const self = this;
    async function generateJwt() {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 86400 * 5;
      const user = await Meteor.users.findOneAsync(self.userId);
      const body = {
        context: {
          user: {
            name: nickAndName(user),
            avatar: gravatarUrl({
              gravatar_md5: hashFromNickObject(user),
              size: 200,
            }),
          },
        },
        aud: "jitsi",
        iss: JITSI_APP_NAME,
        sub: JITSI_SERVER,
        room: roomName,
        exp: expiry,
      };
      const b64Body = Buffer.from(JSON.stringify(body)).toString("base64url");
      const toSign = `${JWT_HEADER}.${b64Body}`;
      const hmac = createHmac("sha256", JITSI_SHARED_SECRET);
      hmac.update(toSign);
      const hash = hmac.digest("base64url");
      return `${toSign}.${hash}`;
    }
    this.added(JITSI_JWT_COLLECTION_NAME, roomName, {
      jwt: await generateJwt(),
    });
    const intervalHandle = Meteor.setInterval(
      async () => {
        this.changed(JITSI_JWT_COLLECTION_NAME, roomName, {
          jwt: await generateJwt(),
        });
      },
      86400 * 100 * 3
    );
    this.onStop(() => Meteor.clearInterval(intervalHandle));
    this.ready();
  })
);

//# Publish the 'facts' collection to all users
Facts.setUserIdFilter(() => true);
