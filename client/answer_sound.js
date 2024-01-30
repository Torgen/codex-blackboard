import AnswerSoundHandler from "/client/imports/answer_sound.js";
import { Puzzles } from "/lib/imports/collections.js";
import { registrationPromise } from "/client/imports/serviceworker.js";
import { MUTE_SOUND_EFFECTS } from "/client/imports/settings.js";

Meteor.startup(function () {
  let useServiceWorker = false;
  const actionMap = new Map();
  function makePlayFunction(path, postMessage, rcvMessage) {
    const sound = new Audio(Meteor._relativeToSiteRootUrl(path));
    async function tryPlay() {
      if (MUTE_SOUND_EFFECTS.get()) {
        return;
      }
      try {
        await sound.play();
      } catch (err) /* istanbul ignore next */ {
        console.error(err.message, err);
      }
    }
    actionMap.set(rcvMessage, tryPlay);
    return function(key) {
      if (useServiceWorker) {
        navigator.serviceWorker.controller.postMessage({
          type: postMessage,
          key,
        });
      } else {
        tryPlay();
      }
    }
  }
  const playNewAnswer = makePlayFunction("/sound/that_was_easy.wav", "puzzlesolved", "playnewanswersound");
  const playPartialAnswer = makePlayFunction("/sound/but_wait_theres_more.mp3", "partialsolved", "playpartialanswersound");
  registrationPromise
    .then(function (reg) {
      useServiceWorker = true;
      navigator.serviceWorker.addEventListener("message", function (msg) {
        const fn = actionMap.get(msg.data.action);
        if (fn) {
          fn();
        }
      });
    })
    .catch(console.log);
  new AnswerSoundHandler(Puzzles, playNewAnswer, playPartialAnswer).start();
});
