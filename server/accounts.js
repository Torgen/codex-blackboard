// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '../lib/imports/canonical.js';
import { createHash } from 'crypto';
import { StringWithLength } from '../lib/imports/match.js';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.js';

const PASSWORD = Meteor.settings?.password ?? process.env.TEAM_PASSWORD;

Meteor.users.deny({
  update() { return true; }});

const sha1 = x => createHash('sha1').update(x).digest('hex');

if (DO_BATCH_PROCESSING) {
  if (PASSWORD != null) {
    const sha_password = sha1(PASSWORD);
    Meteor.startup(function() {
      Meteor.users.update({
        'services.resume': { $exists: true
      },
        'services.codex.password_used': { $exists: false
      }
      }
      ,
        {$set: {'services.codex.password_used': sha_password}}
      ,
        {multi: true});
      return Meteor.users.update({
        'services.resume': { $exists: true
      },
        'services.codex.password_used': { $ne: sha_password
      }
      }
      ,
        {$unset: {'services.resume': ''}}
      ,
        {multi: true});
    });
  }
}


Accounts.registerLoginHandler('codex', function(options) {
  check(options, {
    nickname: String,
    real_name: String,
    gravatar_md5: Match.Optional(String),
    password: String
  }
  );
  if (!Match.test(options.nickname, StringWithLength({min: 1, max: 20}))) {
    throw new Meteor.Error(401, "Nickname must be 1-20 characters long", {field: 'nickname'});
  }
  if (!Match.test(options.real_name, StringWithLength({max: 100}))) {
    throw new Meteor.Error(401, "Real name must be at most 100 characters", {field: 'real_name'});
  }
  if (options.gravatar_md5 != null) {
    if (!/[a-f0-9]{32}/.test(options.gravatar_md5)) {
      options.gravatar_md5 = null;
    }
  }

  if (PASSWORD != null) {
    if (options.password !== PASSWORD) {
      throw new Meteor.Error(401, 'Wrong password', {field: 'password'});
    }
  }

  const canon = canonical(options.nickname);

  const profile = {nickname: options.nickname};
  if (options.gravatar_md5) { profile.gravatar_md5 = options.gravatar_md5; }
  if (options.real_name) { profile.real_name = options.real_name; }
  profile['services.codex.password_used'] = sha1(options.password);

  // If you have the team password, we'll create an account for you.
  try {
    Meteor.users.upsert({
      _id: canon,
      bot_wakeup: { $exists: false
    }
    }
    , {$set: profile});
  } catch (error) {
    throw new Meteor.Error(401, 'Can\'t impersonate the bot', {field: 'nickname'});
  }

  return { userId: canon };
});
