'use strict'

import {gravatarUrl, hashFromNickObject} from './imports/nickEmail.coffee'

Template.gravatar.helpers
  gravatar_md5: ->
    user = Meteor.users.findOne(@nick) or {_id: @nick}
    hashFromNickObject user

Template.gravatar_hash.helpers
  gravatarUrl: -> gravatarUrl @