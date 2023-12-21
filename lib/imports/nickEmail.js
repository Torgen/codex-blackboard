import canonical from "/lib/imports/canonical.js";
import { DEFAULT_HOST } from "/lib/imports/server_settings.js";
import md5 from "md5";

export var gravatarUrl = ({ gravatar_md5, size }) =>
  `https://secure.gravatar.com/avatar/${gravatar_md5}.jpg?d=wavatar&s=${size}`;

export var hashFromNickObject = (nick) =>
  nick.gravatar_md5 || md5(`${nick._id}@${DEFAULT_HOST}`);

export function nickHash(nick) {
  if (nick == null) {
    return;
  }
  const cn = canonical(nick);
  const n = Meteor.users.findOne(cn);
  if (n == null) {
    return "0123456789abcdef0123456789abcdef";
  }
  return hashFromNickObject(n);
}

export function nickAndName(user) {
  if (user?.real_name != null) {
    return `${user.real_name} (${user.nickname})`;
  } else {
    return user.nickname;
  }
}
