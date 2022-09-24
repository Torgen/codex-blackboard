// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '../../lib/imports/canonical.js';
import { DEFAULT_HOST } from '/client/imports/server_settings.js';
import md5 from 'md5';

export var gravatarUrl = ({gravatar_md5, size}) => `https://secure.gravatar.com/avatar/${gravatar_md5}.jpg?d=wavatar&s=${size}`;

export var hashFromNickObject = nick => nick.gravatar_md5 || md5(`${nick._id}@${DEFAULT_HOST}`);

export var nickHash = function(nick) {
  if (nick == null) { return; }
  const cn = canonical(nick);
  const n = Meteor.users.findOne(cn);
  if (n == null) { return '0123456789abcdef0123456789abcdef'; }
  return hashFromNickObject(n);
};

export var nickAndName = function(user) { 
  if (user?.real_name != null) {
    return `${user.real_name} (${user.nickname})`;
  } else {
    return user.nickname;
  }
};
