'use strict'

import {gravatarUrl, hashFromNickObject} from './imports/nickEmail.coffee'
import canonical from '/lib/imports/canonical.coffee'

Template.gravatar.helpers
  gravatar_md5: ->
    user = Meteor.users.findOne(@nick) or {_id: @nick}
    hashFromNickObject user

Template.online_status.helpers
  robot: ->
    u = Meteor.users.findOne(@nick)
    console.log u
    u?.bot_wakeup?
  online: -> 
    u = Meteor.users.findOne(@nick)
    console.log u
    u?.online

Template.gravatar_hash.helpers
  gravatarUrl: -> gravatarUrl @
