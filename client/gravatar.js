import { gravatarUrl, hashFromNickObject } from "/lib/imports/nickEmail.js";

Template.gravatar.helpers({
  gravatar_md5() {
    const user = Meteor.users.findOne(this.nick) || { _id: this.nick };
    return hashFromNickObject(user);
  }
});

Template.online_status.helpers({
  robot() {
    const u = Meteor.users.findOne(this.nick);
    return u?.bot_wakeup != null;
  },
  online() {
    const u = Meteor.users.findOne(this.nick);
    return u?.online;
  }
});

Template.gravatar_hash.helpers({
  gravatarUrl() {
    return gravatarUrl(this);
  }
});
