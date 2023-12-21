import { LastAnswer } from "/lib/imports/collections.js";
import { registrationPromise } from "/client/imports/serviceworker.js";
import { MUTE_SOUND_EFFECTS } from "./imports/settings.js";

Meteor.startup(function () {
  const newAnswerSound = new Audio(
    Meteor._relativeToSiteRootUrl("/sound/that_was_easy.wav")
  );
  async function maybePlay() {
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
        maybePlay();
      });
    })
    .catch(console.log);
  // set up a persistent query so we can play the sound whenever we get a new
  // answer
  // note that this observe 'leaks' -- we're not setting it up/tearing it
  // down with the blackboard page, we're going to play the sound whatever
  // page the user is currently on.  This is "fun".  Trust us...
  Meteor.subscribe("last-answered-puzzle");
  // ignore added; that's just the startup state.  Watch 'changed'
  return LastAnswer.find({}).observe({
    async changed(doc, oldDoc) {
      if (doc.target == null) {
        return;
      } // 'no recent puzzle was solved'
      if (doc.target === oldDoc.target) {
        return;
      } // answer changed, not really new
      console.log("that was easy", doc, oldDoc);
      if (useServiceWorker) {
        navigator.serviceWorker.controller.postMessage({
          type: "puzzlesolved",
          id: doc.target
        });
      } else {
        maybePlay();
      }
    }
  });
});
