export default class AnswerSoundHandler {
  // The puzzles collection to observe.
  #puzzles;

  // Function that plays the new answer and new partial answer sounds.
  // Practically speaking they're probably async, but we won't await them.
  // Parameter is a uniqueness key. If service workers are supported,
  // only one window will play the sound for a given key unless another
  // event arrives in the meantime.
  #newAnswerSound;
  #partialAnswerSound;

  // The autorun computation
  #computation;

  constructor(puzzles, newAnswerSound, partialAnswerSound) {
    this.#puzzles = puzzles;
    this.#newAnswerSound = newAnswerSound;
    this.#partialAnswerSound = partialAnswerSound;
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
              this.#newAnswerSound(document._id);
            }
          },
        });
      const partial = (document) => {
        if (document.last_partial_answer > last) {
          last = document.last_partial_answer;
          console.log("but wait, there's more", document);
          this.#partialAnswerSound(last);
        }
      };
      this.#puzzles
        .find(
          { solved: null, last_partial_answer: { $gt: last } },
          {
            fields: { last_partial_answer: 1 },
            sort: { last_partial_answer: -1 },
            limit: 1,
          }
        )
        .observe({ addedAt: partial, changedAt: partial});
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
