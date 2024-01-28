import AnswerSoundHandler from "/client/imports/answer_sound.js";
import { Puzzles } from "/lib/import/collections.js";
import { registrationPromise } from "/client/imports/serviceworker.js";
import { MUTE_SOUND_EFFECTS } from "/client/imports/settings.js";

Meteor.startup(function () {
  const newAnswerSound = new Audio(
    Meteor._relativeToSiteRootUrl("/sound/that_was_easy.wav")
  );
  async function tryPlay() {
    if (MUTE_SOUND_EFFECTS.get()) {
      return;
    }
    try {
      await newAnswerSound.play();
    } catch (err) /* istanbul ignore next */ {
      console.error(err.message, err);
    }
  }
  let useServiceWorker = false;
  registrationPromise
    .then(function (reg) {
      useServiceWorker = true;
      navigator.serviceWorker.addEventListener("message", async function (msg) {
        if (msg.data.action !== "playnewanswersound") {
          return;
        }
        tryPlay();
      });
    })
    .catch(console.log);
  async function play() {
    if (useServiceWorker) {
      navigator.serviceWorker.controller.postMessage({
        type: "puzzlesolved",
        id: doc.target,
      });
    } else {
      tryPlay();
    }
  }
  new AnswerSoundHandler(Puzzles, play).start();
});
