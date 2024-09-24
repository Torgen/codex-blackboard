import { newMessage } from "/server/imports/newMessage.js";
import { NonEmptyString } from "/lib/imports/match.js";

Meteor.methods({
  async newMessage(args) {
    check(this.userId, NonEmptyString);
    check(args, {
      body: Match.Optional(String),
      bodyIsHtml: Match.Optional(Boolean),
      action: Match.Optional(Boolean),
      to: Match.Optional(NonEmptyString),
      room_name: Match.Optional(NonEmptyString),
      useful: Match.Optional(Boolean),
      bot_ignore: Match.Optional(Boolean),
      on_behalf: Match.Optional(Boolean),
      header_ignore: Match.Optional(Boolean),
      mention: Match.Optional([String]),
    });
    let newMsg = { ...args, nick: this.userId };
    if (newMsg.body == null) {
      newMsg.body = "";
    }
    if (newMsg.room_name == null) {
      newMsg.room_name = "general/0";
    }
    newMsg = await newMessage(newMsg);
    // update the user's 'last read' message to include this one
    // (doing it here allows us to use server timestamp on message)
    if (!args.on_behalf) {
      await Meteor.callAsync("updateLastRead", {
        room_name: newMsg.room_name,
        timestamp: newMsg.timestamp,
      });
    }
    return newMsg;
  },
});
