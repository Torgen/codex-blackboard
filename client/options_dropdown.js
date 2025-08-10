import { JITSI_SERVER } from "/lib/imports/server_settings.js";
import {
  DARK_MODE,
  HIDE_SOLVED,
  HIDE_SOLVED_FAVES,
  HIDE_SOLVED_METAS,
  STUCK_TO_TOP,
  HIDE_USELESS_BOT_MESSAGES,
  MUTE_SOUND_EFFECTS,
  LESS_COLORFUL,
  START_VIDEO_MUTED,
  START_AUDIO_MUTED,
  COMPACT_MODE,
  CURRENT_COLUMNS,
  WHOS_WORKING_STYLE,
} from "./imports/settings.js";

Template.options_dropdown.helpers({
  jitsi: typeof JITSI_SERVER !== "undefined" && JITSI_SERVER !== null,
});

Template.options_dropdown.events({
  "click .bb-display-settings li a"(event, template) {
    // Stop the dropdown from closing.
    event.stopPropagation();
  },
  'click a[name="bb-dark-mode"] [data-darkmode]:not(.disabled)'(
    event,
    template
  ) {
    DARK_MODE.set(event.currentTarget.dataset.darkmode);
  },
  "change .bb-hide-solved input"(event, template) {
    HIDE_SOLVED.set(event.target.checked);
  },
  "change .bb-hide-solved-meta input"(event, template) {
    HIDE_SOLVED_METAS.set(event.target.checked);
  },
  "change .bb-hide-solved-faves input"(event, template) {
    HIDE_SOLVED_FAVES.set(event.target.checked);
  },
  "change .bb-compact-mode input"(event, template) {
    COMPACT_MODE.set(event.target.checked);
  },
  "change .bb-boring-mode input"(event, template) {
    LESS_COLORFUL.set(event.target.checked);
  },
  "change .bb-stuck-to-top input"(event, template) {
    STUCK_TO_TOP.set(event.target.checked);
  },
  "change .bb-bot-mute input"(event, template) {
    HIDE_USELESS_BOT_MESSAGES.set(event.target.checked);
  },
  "change .bb-sfx-mute input"(event, template) {
    MUTE_SOUND_EFFECTS.set(event.target.checked);
  },
  "change .bb-start-video-muted input"(event, template) {
    START_VIDEO_MUTED.set(event.target.checked);
  },
  "change .bb-start-audio-muted input"(event, template) {
    START_AUDIO_MUTED.set(event.target.checked);
  },
  "change input[data-column-visibility]"(event, template) {
    CURRENT_COLUMNS.set(
      template
        .$("input[data-column-visibility]:checked")
        .map(function () {
          return this.dataset.columnVisibility;
        })
        .get()
    );
  },
  'change input[name="whos-working-display-style"]'(event, template) {
    WHOS_WORKING_STYLE.set(event.target.value);
  },
});

Template.options_dropdown_column_checkbox.helpers({
  columnVisible() {
    return CURRENT_COLUMNS.get().includes(this.column);
  },
});
