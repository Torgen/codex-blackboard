'use strict'
import canonical from '../lib/imports/canonical.coffee'
import { StringWithLength } from '../lib/imports/match.coffee'

PASSWORD = Meteor.settings?.password ? process.env.TEAM_PASSWORD 

Meteor.users.deny
  update: -> true

Accounts.registerLoginHandler 'codex', (options) ->
  check options,
    nickname: StringWithLength {min: 1, max: 20}
    real_name: StringWithLength max: 100
    gravatar: StringWithLength max: 100
    password: String

  if PASSWORD?
    unless options.password is PASSWORD
      throw new Meteor.Error 401, 'Wrong password'

  canon = canonical options.nickname

  profile = nickname: options.nickname
  profile.gravatar = options.gravatar if options.gravatar
  profile.real_name = options.real_name if options.real_name

  # If you have the team password, we'll create an account for you.
  try
    Meteor.users.upsert
      _id: canon
      bot_wakeup: $exists: false
    , $set: profile
  catch error
    throw new Meteor.Error 401, 'Can\'t impersonate the bot'

  return { userId: canon }
