import canonical from "/lib/imports/canonical.js";
import { collection, JitsiJWTs } from "/lib/imports/collections.js";
import { StaticJitsiMeeting } from "/lib/imports/settings.js";
import { JITSI_SERVER, TEAM_NAME } from "/lib/imports/server_settings.js";
import { START_AUDIO_MUTED, START_VIDEO_MUTED } from "./settings.js";

export function jitsiRoom(roomType, roomId) {
  if (!roomId) {
    return;
  }
  let meeting = `${roomType}_${roomId}`;
  if (roomId === "0") {
    if (!StaticJitsiMeeting.get()) {
      return;
    }
    meeting = StaticJitsiMeeting.get();
  } else {
    const override = collection(roomType)?.findOne({ _id: roomId })?.tags?.jitsi
      ?.value;
    if (override != null) {
      meeting = override;
    }
  }
  return `${canonical(TEAM_NAME)}_${meeting}`;
}

// We need settings to load the jitsi api since it's conditional and the domain
// is variable. This means we can't put it in the head, and putting it in the
// body can mean the embedded chat is already rendered when it loads.
// Therefore we set this ReactiveVar if/when it's finished loading so we
// can retry the appropriate autorun once it loads.
const jitsiLoaded = new ReactiveVar(false);

Meteor.startup(function () {
  if (!JITSI_SERVER) {
    return;
  }
  $("body").addClass("using-jitsi");
  $.getScript(`https://${JITSI_SERVER}/external_api.js`, () =>
    jitsiLoaded.set(true)
  );
});

export function createJitsiMeet(room, container) {
  if (!jitsiLoaded.get()) {
    return null;
  }
  const jwtObj = JitsiJWTs.findOne(room);
  if (!jwtObj) {
    return null;
  }
  return new JitsiMeetExternalAPI(JITSI_SERVER, {
    roomName: room,
    parentNode: container,
    jwt: jwtObj.jwt,
    interfaceConfigOverwrite: {
      DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      TOOLBAR_BUTTONS: [
        "microphone",
        "camera",
        "desktop",
        "fullscreen",
        "fodeviceselection",
        "profile",
        "sharedvideo",
        "settings",
        "raisehand",
        "videoquality",
        "filmstrip",
        "feedback",
        "shortcuts",
        "tileview",
        "videobackgroundblur",
        "help",
        "hangup",
      ],
      SHOW_CHROME_EXTENSION_BANNER: false,
    },
    configOverwrite: {
      // These properties are reactive, but changing them won't make us reload the room
      // because newRoom will be the same as @jitsiRoom.
      startWithAudioMuted: START_AUDIO_MUTED.get(),
      startWithVideoMuted: START_VIDEO_MUTED.get(),
      prejoinPageEnabled: false,
      prejoinConfig: {
        enabled: false,
      },
      enableTalkWhileMuted: false,
      disableDeepLinking: true,
      disableModeratorIndicator: true,
      disabledSounds: ["PARTICIPANT_JOINED_SOUND", "PARTICIPANT_LEFT_SOUND"],
      "analytics.disabled": true,
    },
  });
}

export function jitsiUrl(roomType, roomId) {
  if (!JITSI_SERVER) {
    return;
  }
  const room = jitsiRoom(roomType, roomId);
  if (room == null) {
    return;
  }
  let url = `https://${JITSI_SERVER}/${room}`;
  let jwtObj = JitsiJWTs.findOne(room);
  if (!jwtObj) {
    jwtObj = JitsiJWTs.findOne("*");
  }
  if (jwtObj?.jwt) {
    url = url + `?jwt=${jwtObj.jwt}`;
  }
  return url;
}
