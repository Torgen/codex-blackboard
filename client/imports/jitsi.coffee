'use strict'

import canonical from '/lib/imports/canonical.coffee'

export default jitsiUrl = (roomType, roomId) ->
  return unless share.settings.JITSI_SERVER
  return unless roomId?
  return if roomId is '0'
  return "https://#{share.settings.JITSI_SERVER}/#{canonical(share.settings.TEAM_NAME)}/#{roomType}-#{roomId}"
