// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '/lib/imports/canonical.js';
import { collection } from '/lib/imports/collections.js';
import { StaticJitsiMeeting } from '/lib/imports/settings.js';
import { JITSI_SERVER, TEAM_NAME } from '/client/imports/server_settings.js';
import { START_AUDIO_MUTED, START_VIDEO_MUTED } from './settings.js';

export var jitsiRoom = function(roomType, roomId) {
  if (!roomId) { return; }
  let meeting = `${roomType}_${roomId}`;
  if (roomId === '0') {
    if (!StaticJitsiMeeting.get()) { return; }
    meeting = StaticJitsiMeeting.get();
  } else {
    const override = collection(roomType)?.findOne({_id: roomId})?.tags?.jitsi?.value;
    if (override != null) { meeting = override; }
  }
  return `${canonical(TEAM_NAME)}_${meeting}`;
};

// We need settings to load the jitsi api since it's conditional and the domain
// is variable. This means we can't put it in the head, and putting it in the
// body can mean the embedded chat is already rendered when it loads.
// Therefore we set this ReactiveVar if/when it's finished loading so we
// can retry the appropriate autorun once it loads.
const jitsiLoaded = new ReactiveVar(false);

Meteor.startup(function() {
  if (!JITSI_SERVER) { return; }
  $('body').addClass('using-jitsi');
  return $.getScript(`https://${JITSI_SERVER}/external_api.js`, () => jitsiLoaded.set(true));
});

export var createJitsiMeet = function(room, container) {
  if (!jitsiLoaded.get()) { return null; }
  return new JitsiMeetExternalAPI(JITSI_SERVER, {
    roomName: room,
    parentNode: container,
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'fullscreen', 
        'fodeviceselection', 'profile', 'sharedvideo', 'settings', 
        'raisehand', 'videoquality', 'filmstrip', 'feedback', 'shortcuts', 
        'tileview', 'videobackgroundblur', 'help', 'hangup' ],
      SHOW_CHROME_EXTENSION_BANNER: false
    },
    configOverwrite: {
      // These properties are reactive, but changing them won't make us reload the room
      // because newRoom will be the same as @jitsiRoom.
      startWithAudioMuted: START_AUDIO_MUTED.get(),
      startWithVideoMuted: START_VIDEO_MUTED.get(),
      prejoinPageEnabled: false,
      enableTalkWhileMuted: false,
      'analytics.disabled': true
    }
  }
  );
};

export var jitsiUrl = function(roomType, roomId) {
  if (!JITSI_SERVER) { return; }
  const room = jitsiRoom(roomType, roomId);
  if (room == null) { return; }
  return `https://${JITSI_SERVER}/${room}`;
};
