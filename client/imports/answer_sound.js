export default class AnswerSoundHandler {
  // The puzzles collection to observe.
  #puzzles;

  // Function that plays the new answer sound.
  // Practically speaking it's probably async, but we won't await it.
  #newAnswerSound;

  // The autorun computation
  #computation;

  constructor(puzzles, newAnswerSound) {
    this.#puzzles = puzzles;
    this.#newAnswerSound = newAnswerSound;
  }

  start() {
    if (this.#computation) {
      throw new Error("Autorun was already running");
    }

    this.#computation = Tracker.autorun(() => {
      if (!Meteor.user()) {
        return;
      }
      let last = Date.now();
      this.#puzzles
        .find(
          { solved: { $gt: last } },
          { fields: { solved: 1 }, sort: { solved: -1 }, limit: 1 }
        )
        .observe({
          addedAt: (document) => {
            if (document.solved > last) {
              last = document.solved;
              console.log("that was easy", document);
              this.#newAnswerSound();
            }
          },
        });
    });
  }

  stop() {
    if (!this.#computation) {
      throw new Error("Autorun wasn't running");
    }

    this.#computation.stop();
    this.#computation = null;
  }
}
