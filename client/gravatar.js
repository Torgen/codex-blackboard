/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import {gravatarUrl, hashFromNickObject} from './imports/nickEmail.coffee';

Template.gravatar.helpers({
  gravatar_md5() {
    const user = Meteor.users.findOne(this.nick) || {_id: this.nick};
    return hashFromNickObject(user);
  }
});

Template.online_status.helpers({
  robot() {
    const u = Meteor.users.findOne(this.nick);
    return (u?.bot_wakeup != null);
  },
  online() { 
    const u = Meteor.users.findOne(this.nick);
    return u?.online;
  }
});

Template.gravatar_hash.helpers({
  gravatarUrl() { return gravatarUrl(this); }});
