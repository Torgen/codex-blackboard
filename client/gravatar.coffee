'use strict'

import {gravatarUrl, hashFromNickObject} from './imports/nickEmail.coffee'

Template.gravatar.helpers
  gravatar_md5: ->
    user = Meteor.users.findOne(@nick) or {_id: @nick}
    hashFromNickObject user

Template.online_status.helpers
  robot: ->
    u = Meteor.users.findOne(@nick)
    u?.bot_wakeup?
  online: -> 
    u = Meteor.users.findOne(@nick)
    u?.online

Template.gravatar_hash.helpers
  gravatarUrl: -> gravatarUrl @
