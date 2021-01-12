'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { StaticJitsiMeeting } from '/lib/imports/settings.coffee'

export jitsiRoom = (roomType, roomId) ->
  return unless roomId
  meeting = "#{roomType}_#{roomId}"
  if roomId is '0'
    return unless StaticJitsiMeeting.get()
    meeting = StaticJitsiMeeting.get()
  else
    override = share.model.collection(roomType)?.findOne(_id: roomId)?.tags?.jitsi?.value
    meeting = override if override?
  "#{canonical(share.settings.TEAM_NAME)}_#{meeting}"

export default jitsiUrl = (roomType, roomId) ->
  return unless share.settings.JITSI_SERVER
  room = jitsiRoom roomType, roomId
  return unless room?
  "https://#{share.settings.JITSI_SERVER}/#{room}"
