'use strict'

import canonical from '/lib/imports/canonical.coffee'

export jitsiRoom = (roomType, roomId) ->
  return unless roomId
  return unless share.settings.JITSI_STATIC_ROOM?
  return "#{canonical(share.settings.TEAM_NAME)}-#{canonical(share.settings.JITSI_STATIC_ROOM)}" if roomId is '0'
  "#{canonical(share.settings.TEAM_NAME)}-#{roomType}-#{roomId}"

export default jitsiUrl = (roomType, roomId) ->
  return unless share.settings.JITSI_SERVER
  room = jitsiRoom roomType, roomId
  return unless room?
  "https://#{share.settings.JITSI_SERVER}/#{room}"
