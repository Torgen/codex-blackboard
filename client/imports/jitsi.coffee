'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { StaticJitsiMeeting } from '/lib/imports/settings.coffee'

export jitsiRoom = (roomType, roomId) ->
  return unless roomId
  if roomId is '0'
    return unless StaticJitsiMeeting.get()
    return "#{canonical(share.settings.TEAM_NAME)}-#{StaticJitsiMeeting.get()}"
  "#{canonical(share.settings.TEAM_NAME)}-#{roomType}-#{roomId}"

export default jitsiUrl = (roomType, roomId) ->
  return unless share.settings.JITSI_SERVER
  room = jitsiRoom roomType, roomId
  return unless room?
  "https://#{share.settings.JITSI_SERVER}/#{room}"
