import "./index.html";
import { findByChannel } from "/client/imports/presence_index.js";

Template.room_presence.helpers({
  jitsi() {
    return findByChannel(`${this.room_name}`, { jitsi: { $gt: 0 } });
  },
  chat_only() {
    return findByChannel(`${this.room_name}`, { jitsi: 0 });
  },
});
