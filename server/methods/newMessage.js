// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

import { newMessage } from '/server/imports/newMessage.js';
import { NonEmptyString } from '/lib/imports/match.js';

Meteor.methods({
  newMessage(args) {
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
      mention: Match.Optional([String])
    });
    let newMsg = {...args, nick: this.userId};
    if (newMsg.body == null) { newMsg.body = ''; }
    if (newMsg.room_name == null) { newMsg.room_name = "general/0"; }
    newMsg = newMessage(newMsg);
    // update the user's 'last read' message to include this one
    // (doing it here allows us to use server timestamp on message)
    if (!args.on_behalf) {
      Meteor.call('updateLastRead', {
        room_name: newMsg.room_name,
        timestamp: newMsg.timestamp
      }
      );
    }
    return newMsg;
  }
});