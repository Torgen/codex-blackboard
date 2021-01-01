'use strict'
import canonical from '../lib/imports/canonical.coffee'
import { md } from 'node-forge'
import { StringWithLength } from '../lib/imports/match.coffee'

PASSWORD = Meteor.settings?.password ? process.env.TEAM_PASSWORD 

Meteor.users.deny
  update: -> true

sha1 = (x) ->
  md.sha1.create().update(x).digest().toHex()

if share.DO_BATCH_PROCESSING
  if PASSWORD?
    sha_password = sha1 PASSWORD
    Meteor.startup ->
      Meteor.users.update
        'services.resume': $exists: true
        'services.codex.password_used': $exists: false
      ,
        $set: 'services.codex.password_used': sha_password
      ,
        multi: true
      Meteor.users.update
        'services.resume': $exists: true
        'services.codex.password_used': $ne: sha_password
      ,
        $unset: 'services.resume': ''
      ,
        multi: true
      

Accounts.registerLoginHandler 'codex', (options) ->
  check options,
    nickname: String
    real_name: String
    gravatar_md5: Match.Optional String
    password: String
  unless Match.test options.nickname, StringWithLength(min: 1, max: 20)
    throw new Meteor.Error 401, "Nickname must be 1-20 characters long", field: 'nickname'
  unless Match.test options.real_name, StringWithLength(max: 100)
    throw new Meteor.Error 401, "Real name must be at most 100 characters", field: 'real_name'
  if options.gravatar_md5?
    unless /[a-f0-9]{32}/.test options.gravatar_md5
      options.gravatar_md5 = null

  if PASSWORD?
    unless options.password is PASSWORD
      throw new Meteor.Error 401, 'Wrong password', field: 'password'

  canon = canonical options.nickname

  profile = nickname: options.nickname
  profile.gravatar_md5 = options.gravatar_md5 if options.gravatar_md5
  profile.real_name = options.real_name if options.real_name
  profile['services.codex.password_used'] = sha1 options.password

  # If you have the team password, we'll create an account for you.
  try
    Meteor.users.upsert
      _id: canon
      bot_wakeup: $exists: false
    , $set: profile
  catch error
    throw new Meteor.Error 401, 'Can\'t impersonate the bot', field: 'nickname'

  return { userId: canon }
