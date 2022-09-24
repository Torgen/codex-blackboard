// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { CHAT_LIMIT_INCREMENT } from '/client/imports/server_settings.js';
import { Messages, pretty_collection } from '/lib/imports/collections.js';

const room_name = 'oplog/0';

Template.oplog.helpers({
  oplogs() {
    return Messages.find({room_name},
      {sort: [['timestamp','asc']]});
  },
  prettyType() {
    return pretty_collection(this.type);
  },
  // The dawn of time message has ID equal to the room name because it's
  // efficient to find it that way on the client, where there are no indexes.
  startOfChannel() { return (Messages.findOne({_id: room_name}) != null); }
});

Template.oplog.onRendered(function() {
  $("title").text("Operation Log Archive");
  return document?.querySelector?.('.bb-oplog > *:last-child')?.scrollIntoView();
});

Template.oplog.onCreated(function() { return this.autorun(() => {
  return this.subscribe('recent-messages', room_name, +Session.get('limit'));
});
 });

Template.oplog.events({
  'click .bb-oplog-load-more'(event, template) {
    return Session.set('limit', Session.get('limit') + CHAT_LIMIT_INCREMENT);
  }
});
