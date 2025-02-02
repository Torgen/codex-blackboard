import canonical from "/lib/imports/canonical.js";
import { Messages, Presence } from "/lib/imports/collections.js";
import md5 from "md5";
import { callAs } from "./impersonate.js";
import Hubot from "hubot/es2015";

// Log messages?
const DEBUG = !Meteor.isProduction;

// Monkey-patch Hubot to support private messages and add message back to the envelope
class BlackboardResponse extends Hubot.Response {
  constructor(robot, message, match) {
    super(robot, message, match);
    this.envelope.message = this.message;
  }
  async priv(...strings) {
    return await this.send({ to: this.envelope.user.id }, ...strings);
  }
}

const tweakStrings = (strings, f) =>
  strings.map(function (obj) {
    if (typeof obj === "string") {
      return f(obj);
    } else {
      return obj;
    }
  });

class BlackboardAdapter extends Hubot.Adapter {
  async sendHelper(envelope, strings, map, join = true) {
    const props = Object.create(null);
    const lines = [];
    while (strings.length > 0) {
      if (typeof strings[0] === "function") {
        strings[0] = strings[0]();
        continue;
      }
      const string = strings.shift();
      if (typeof string === "object") {
        Object.assign(props, string);
        continue;
      }
      if (string != null) {
        lines.push(string);
      }
    }
    if (lines.length && envelope.message.direct && !props.useful) {
      await Messages.updateAsync(envelope.message.id, {
        $set: { useless_cmd: true },
      });
    }
    // be present in the room
    if (join && !Object.hasOwn(props, "to")) {
      try {
        await this.present(envelope.room);
      } catch (error) {}
    }
    for (const line of lines) {
      try {
        await map(line, props);
      } catch (err) {
        /* istanbul ignore else */
        if (DEBUG) {
          console.error(`Hubot error: ${err}`);
        }
      }
    }
  }
  constructor(robot, botname, gravatar) {
    super(robot);

    // what's (the regexp for) my name?
    this.botname = botname;
    this.gravatar = gravatar;
    robot.respond(/(?:)/, () => false);
    this.mynameRE = robot.listeners.pop().regex;
    /** @type boolean */
    this.running = false;
  }

  // Public: Raw method for sending data back to the chat source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each message to send.
  //
  // Returns nothing.
  async send(envelope, ...strings) {
    if (envelope.message.private) {
      await this.priv(envelope, ...strings);
      return;
    }
    await this.sendHelper(envelope, strings, async (string, props) => {
      /* istanbul ignore else */
      if (DEBUG) {
        console.log(`send ${envelope.room}: ${string} (${envelope.user.id})`);
      }
      if (
        envelope.message.direct &&
        !props.useful &&
        !string.startsWith(`@${envelope.user.id}`) &&
        !props.to
      ) {
        string = `@${envelope.user.id}: ${string}`;
      }
      await callAs(
        "newMessage",
        this.botname,
        Object.assign({}, props, {
          body: string,
          room_name: envelope.room,
          bot_ignore: true,
        })
      );
    });
  }

  // Public: Raw method for sending emote data back to the chat source.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each message to send.
  //
  // Returns nothing.
  async emote(envelope, ...strings) {
    if (envelope.message.private) {
      await this.priv(
        envelope,
        ...tweakStrings(strings, (s) => `*** ${s} ***`)
      );
      return;
    }
    await this.sendHelper(envelope, strings, async (string, props) => {
      /* istanbul ignore else */
      if (DEBUG) {
        console.log(`emote ${envelope.room}: ${string} (${envelope.user.id})`);
      }
      await callAs(
        "newMessage",
        this.botname,
        Object.assign({}, props, {
          body: string,
          room_name: envelope.room,
          action: true,
          bot_ignore: true,
        })
      );
    });
  }

  // Priv: our extension -- send a PM to user
  async priv(envelope, ...strings) {
    await this.sendHelper(
      envelope,
      strings,
      async (string, props) => {
        /* istanbul ignore else */
        if (DEBUG) {
          console.log(`priv ${envelope.room}: ${string} (${envelope.user.id})`);
        }
        await callAs(
          "newMessage",
          this.botname,
          Object.assign({}, props, {
            to: `${envelope.user.id}`,
            body: string,
            room_name: envelope.room,
            bot_ignore: true,
          })
        );
      },
      false
    );
  }

  // Public: Raw method for building a reply and sending it back to the chat
  // source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each reply to send.
  //
  // Returns nothing.
  async reply(envelope, ...strings) {
    if (envelope.message.private) {
      await this.priv(envelope, ...strings);
      return;
    } else {
      await this.send(
        envelope,
        ...[
          { mention: [envelope.user.id] },
          ...tweakStrings(strings, (str) => `@${envelope.user.id}: ${str}`),
        ]
      );
    }
  }

  async present(room_name) {
    const now = Date.now();
    await Presence.upsertAsync(
      { scope: "chat", room_name, nick: this.botname },
      {
        $set: {
          timestamp: now,
          bot: true,
        },
        $setOnInsert: {
          joined_timestamp: now,
        },
        $push: {
          clients: {
            connection_id: "hubot_adapter",
            timestamp: now,
          },
        },
      }
    );
    await Presence.updateAsync(
      { scope: "chat", room_name, nick: this.botname },
      {
        $pull: {
          clients: {
            connection_id: "hubot_adapter",
            timestamp: { $lt: now },
          },
        },
      }
    );
  }

  // Public: Raw method for invoking the bot to run. Extend this.
  //
  // Returns nothing.
  async run() {
    // register our nick
    await Meteor.users.upsertAsync(this.botname, {
      $set: {
        nickname: this.robot.name,
        gravatar_md5: md5(this.gravatar),
        bot_wakeup: Date.now(),
      },
      $unset: { services: "" },
    });
    // register our presence in general chat
    const keepalive = async () => await this.present("general/0");
    await keepalive();
    this.keepalive = Meteor.setInterval(keepalive, 30 * 1000); // every 30s refresh presence

    const IGNORED_NICKS = new Set(["", this.botname]);
    this.running = true;
    this.handle = Messages.rawCollection().watch([
      { $match: { operationType: "insert" } },
    ]);
    this.handle.on("change", async ({ fullDocument: { _id: id, ...msg } }) => {
      // Allows us to shutdown synchronously without awaiting the close() promise.
      if (!this.running) {
        return;
      }
      if (msg.bot_ignore) {
        return;
      }
      if (IGNORED_NICKS.has(msg.nick)) {
        return;
      }
      // Copy user, adding room. Room is needed for the envelope, but if we
      // made the user here anew we would need to query the users table to get
      // the real name.
      const user = Object.create(this.robot.brain.userForId(msg.nick));
      Object.assign(user, { room: msg.room_name });
      if (msg.presence != null) {
        let pm;
        switch (msg.presence) {
          case "join":
            pm = new Hubot.EnterMessage(user, null, id);
            break;
          case "part":
            pm = new Hubot.LeaveMessage(user, null, id);
            break;
          /* istanbul ignore next */
          default:
            console.warn("Weird presence message:", msg);
            return;
        }
        await this.receive(pm);
        return;
      }
      if (msg.system || msg.action || msg.oplog || msg.bodyIsHtml || msg.poll) {
        return;
      }
      /* istanbul ignore else */
      if (DEBUG) {
        console.log(
          `Received from ${msg.nick} in ${msg.room_name}: ${msg.body}`
        );
      }
      const tm = new Hubot.TextMessage(user, msg.body, id);
      tm.private = msg.to != null;
      // if private, ensure it's treated as a direct address
      tm.direct = this.mynameRE.test(tm.text);
      if (tm.private && !tm.direct) {
        tm.text = `${this.robot.name} ${tm.text}`;
      }
      await this.receive(tm);
    });
    this.handle.on("error", console.error);
    await callAs("newMessage", this.botname, {
      body: "wakes up",
      room_name: "general/0",
      action: true,
      bot_ignore: true,
      header_ignore: true,
    });
    this.emit("connected");
  }

  // Public: Raw method for shutting the bot down.
  //
  // Returns nothing.
  close() {
    this.running = false;
    this.handle?.close().catch(console.error);
    Meteor.clearInterval(this.keepalive);
  }
}

export default class BlackboardRobot extends Hubot.Robot {
  constructor(botname, gravatar) {
    super("blackboard", false, botname, "bot");
    this.adapter = new BlackboardAdapter(this, canonical(this.name), gravatar);
    this.gravatar = gravatar;
    this.Response = BlackboardResponse;
    this.logger.warning = this.logger.warn;
  }

  hear(regex, callback) {
    return super.hear(regex, this.privatize(callback));
  }
  respond(regex, callback) {
    return super.respond(regex, this.privatize(callback));
  }
  enter(callback) {
    return super.enter(this.privatize(callback));
  }
  leave(callback) {
    return super.leave(this.privatize(callback));
  }
  topic(callback) {
    return super.topic(this.privatize(callback));
  }
  error(callback) {
    return super.error(this.privatize(callback));
  }
  catchAll(callback) {
    return super.catchAll(this.privatize(callback));
  }
  privately(callback) {
    // Call the given callback on this such that any listeners it registers will
    // behave as though they received a private message.
    this.private = true;
    try {
      return callback(this);
    } finally {
      this.private = false;
    }
  }
  privatize(callback) {
    return this.private
      ? function (resp) {
          resp.message.private = true;
          return callback(resp);
        }
      : callback;
  }
}
