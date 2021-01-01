'use strict'

import canonical from '../../lib/imports/canonical.coffee'
import md5 from '/lib/imports/md5.coffee'

export gravatarUrl = ({gravatar_md5, size}) -> "https://secure.gravatar.com/avatar/#{gravatar_md5}.jpg?d=wavatar&s=#{size}"

export hashFromNickObject = (nick) -> nick.gravatar_md5 or md5("#{nick._id}@#{share.settings.DEFAULT_HOST}")

export nickHash = (nick) ->
  return unless nick?
  cn = canonical nick
  n = Meteor.users.findOne cn
  return '0123456789abcdef0123456789abcdef' unless n?
  hashFromNickObject n
