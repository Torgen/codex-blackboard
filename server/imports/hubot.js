// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '/lib/imports/canonical.js';
import { Messages, Presence } from '/lib/imports/collections.js';
import md5 from 'md5';
import { callAs } from './impersonate.js';
import Hubot from 'hubot/es2015';

// Log messages?
const DEBUG = !Meteor.isProduction;

// Monkey-patch Hubot to support private messages
Hubot.Response.prototype.priv = function(...strings) {
  return this.robot.adapter.priv(this.envelope, ...strings);
};

const tweakStrings = (strings, f) => strings.map(function(obj) {
  if (typeof(obj) === 'string') { return f(obj); } else { return obj; }
});

class BlackboardAdapter extends Hubot.Adapter {
  static initClass() {
  
    this.prototype.sendHelper = Meteor.bindEnvironment(function(envelope, strings, map) {
      // be present in the room
      try {
        this.present(envelope.room);
      } catch (error) {}
      const props = Object.create(null);
      const lines = [];
      while (strings.length > 0) {
        if (typeof(strings[0]) === 'function') {
          strings[0] = strings[0]();
          continue;
        }
        const string = strings.shift();
        if (typeof(string) === 'object') {
          Object.assign(props, string);
          continue;
        }
        if (string != null) {
          lines.push(string);
        }
      }
      if (lines.length && envelope.message.direct && (!props.useful)) {
        Messages.update(envelope.message.id, {$set: {useless_cmd: true}});
      }
      return lines.map(function(line) {
        try {
          return map(line, props);
        } catch (err) {
          if (DEBUG) { return console.error(`Hubot error: ${err}`); }
        }
      });
    });
  }
  constructor(robot, botname, gravatar) {
    super(robot);
    
    // what's (the regexp for) my name?
    this.botname = botname;
    this.gravatar = gravatar;
    robot.respond(/(?:)/, () => false);
    this.mynameRE = robot.listeners.pop().regex;
  }
  
  // Public: Raw method for sending data back to the chat source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each message to send.
  //
  // Returns nothing.
  send(envelope, ...strings) {
    if (envelope.message.private) { return this.priv(envelope, ...strings); }
    return this.sendHelper(envelope, strings, (string, props) => {
      if (DEBUG) { console.log(`send ${envelope.room}: ${string} (${envelope.user.id})`); }
      if (envelope.message.direct && (!props.useful)) {
        if (!string.startsWith(`@${envelope.user.id}`)) {
          string = `@${envelope.user.id}: ${string}`;
        }
      }
      return callAs("newMessage", this.botname, Object.assign({}, props, {
        body: string,
        room_name: envelope.room,
        bot_ignore: true
      }
      )
      );
    });
  }

  // Public: Raw method for sending emote data back to the chat source.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each message to send.
  //
  // Returns nothing.
  emote(envelope, ...strings) {
    if (envelope.message.private) {
      return this.priv(envelope, ...tweakStrings(strings, s => `*** ${s} ***`));
    }
    return this.sendHelper(envelope, strings, (string, props) => {
      if (DEBUG) { console.log(`emote ${envelope.room}: ${string} (${envelope.user.id})`); }
      return callAs("newMessage", this.botname, Object.assign({}, props, {
        body: string,
        room_name: envelope.room,
        action: true,
        bot_ignore: true
      }
      )
      );
    });
  }

  // Priv: our extension -- send a PM to user
  priv(envelope, ...strings) {
    return this.sendHelper(envelope, strings, (string, props) => {
      if (DEBUG) { console.log(`priv ${envelope.room}: ${string} (${envelope.user.id})`); }
      return callAs("newMessage", this.botname, Object.assign({}, props, {
        to: `${envelope.user.id}`,
        body: string,
        room_name: envelope.room,
        bot_ignore: true
      }
      )
      );
    });
  }

  // Public: Raw method for building a reply and sending it back to the chat
  // source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more Strings for each reply to send.
  //
  // Returns nothing.
  reply(envelope, ...strings) {
    if (envelope.message.private) {
      return this.priv(envelope, ...strings);
    } else {
      return this.send(envelope, ...[{mention: [envelope.user.id]}, ...tweakStrings(strings, str => `@${envelope.user.id}: ${str}`)]);
    }
  }

  // Public: Raw method for setting a topic on the chat source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One more more Strings to set as the topic.
  //
  // Returns nothing.
  topic(envelope, ...strings) {}

  // Public: Raw method for playing a sound in the chat source. Extend this.
  //
  // envelope - A Object with message, room and user details.
  // strings  - One or more strings for each play message to send.
  //
  // Returns nothing
  play(envelope, ...strings) {}

  // Public: Raw method for invoking the bot to run. Extend this.
  //
  // Returns nothing.
  run() {
    // register our nick
    Meteor.users.upsert(this.botname, {
      $set: {
        nickname: this.robot.name,
        gravatar_md5: md5(this.gravatar),
        bot_wakeup: Date.now()
      },
      $unset: { services: ''
    }
    }
    );
    // register our presence in general chat
    this.present = room_name => {
      const now = Date.now(); 
      Presence.upsert({scope: 'chat', room_name, nick: this.botname}, {
        $set: {
          timestamp: now,
          bot: true
        },
        $setOnInsert: {
          joined_timestamp: now
        },
        $push: { clients: {
          connection_id: 'hubot_adapter',
          timestamp: now
        }
      }
      }
      );
      return Presence.update({scope: 'chat', room_name, nick: this.botname}, {
        $pull: { clients: { 
          connection_id: 'hubot_adapter',
          timestamp: { $lt: now
        }
        }
      }
      }
      );
    };
    const keepalive = () => this.present('general/0');
    keepalive();
    this.keepalive = Meteor.setInterval(keepalive, 30*1000); // every 30s refresh presence
    
    const IGNORED_NICKS = new Set(['', this.botname]);
    // listen to the chat room, ignoring messages sent before we startup
    let startup = true;
    const query = Messages.find({timestamp: {$gt: Date.now()}});
    this.handle = query.observeChanges({
      added: (id, msg) => {
        if (startup) { return; }
        if (msg.bot_ignore) { return; }
        if (IGNORED_NICKS.has(msg.nick)) { return; }
        // Copy user, adding room. Room is needed for the envelope, but if we
        // made the user here anew we would need to query the users table to get
        // the real name.
        const user = Object.create(this.robot.brain.userForId(msg.nick));
        Object.assign(user, {room: msg.room_name});
        if (msg.presence != null) {
          let pm;
          if (msg.presence === 'join') {
            pm = new Hubot.EnterMessage(user, null, id);
          } else if (msg.presence === 'part') {
            pm = new Hubot.LeaveMessage(user, null, id);
          } else {
            console.warn('Weird presence message:', msg);
            return;
          }
          this.receive(pm);
          return;
        }
        if (msg.system || msg.action || msg.oplog || msg.bodyIsHtml || msg.poll) { return; }
        if (DEBUG) { console.log(`Received from ${msg.nick} in ${msg.room_name}: ${msg.body}`); }
        const tm = new Hubot.TextMessage(user, msg.body, id);
        tm.private = (msg.to != null);
        // if private, ensure it's treated as a direct address
        tm.direct = this.mynameRE.test(tm.text);
        if (tm.private && !tm.direct) {
          tm.text = `${this.robot.name} ${tm.text}`;
        }
        return this.receive(tm);
      }
    });
    startup = false;
    callAs("newMessage", this.botname, {
      body: 'wakes up',
      room_name: 'general/0',
      action: true,
      bot_ignore: true,
      header_ignore: true
    }
    );
    return this.emit('connected');
  }

  // Public: Raw method for shutting the bot down.
  //
  // Returns nothing.
  close() {
    this.handle?.stop();
    return Meteor.clearInterval(this.keepalive);
  }
}
BlackboardAdapter.initClass();

// grrrr, Meteor.bindEnvironment doesn't preserve `this` apparently
const bind = function(f) {
  const g = Meteor.bindEnvironment((self, ...args) => f.apply(self, args));
  return function(...args) { return g(this, ...args); };
};

Hubot.Robot.prototype.loadAdapter = function() {};

export default class Robot extends Hubot.Robot {
  constructor(botname, gravatar) {
    super(null, 'shell', false, botname, 'bot');
    this.gravatar = gravatar;
    this.hear = bind(this.hear);
    this.respond = bind(this.respond);
    this.enter = bind(this.enter);
    this.leave = bind(this.leave);
    this.topic = bind(this.topic);
    this.error = bind(this.error);
    this.catchAll = bind(this.catchAll);
    this.adapter = new BlackboardAdapter(this, canonical(this.name), this.gravatar);
  }

  hear(regex, callback) { return super.hear(regex, this.privatize(callback)); }
  respond(regex, callback) { return super.respond(regex, this.privatize(callback)); }
  enter(callback) { return super.enter(this.privatize(callback)); }
  leave(callback) { return super.leave(this.privatize(callback)); }
  topic(callback) { return super.topic(this.privatize(callback)); }
  error(callback) { return super.error(this.privatize(callback)); }
  catchAll(callback) { return super.catchAll(this.privatize(callback)); }
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
    return Meteor.bindEnvironment(this.private ?
      function(resp) {
        resp.message.private = true;
        return callback(resp);
      }
    : callback
    );
  }
}

