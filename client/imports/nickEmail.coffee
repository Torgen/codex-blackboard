'use strict'

import canonical from '../../lib/imports/canonical.coffee'

export emailFromNickObject = (nick) -> nick.gravatar or "#{nick._id}@#{share.settings.DEFAULT_HOST}"  

export nickEmail = (nick) ->
  return unless nick?
  cn = canonical nick
  n = Meteor.users.findOne cn
  return "" unless n?
  emailFromNickObject n
