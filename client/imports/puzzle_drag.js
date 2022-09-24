/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const PUZZLE_MIME_TYPE = 'application/prs.codex-puzzle';

export default class PuzzleDrag {
  constructor(puzzle, meta, round, target, clientY, dataTransfer) {
    this.id = puzzle._id;
    const rect = target.getBoundingClientRect();
    this.fromTop = clientY - rect.top;
    this.fromBottom = rect.bottom - clientY;
    this.meta = meta?._id;
    this.round = round?._id;
    dataTransfer.setData(PUZZLE_MIME_TYPE, this.id);
    dataTransfer.effectAllowed = 'move';
  }

  dragover(puzzle, meta, round, target, clientY, dataTransfer) {
    if (!dataTransfer.types.includes(PUZZLE_MIME_TYPE)) { return false; }
    const myId = puzzle._id;
    if (this.id === myId) {
      return true; // Drop okay, but nothing to do
    }
    if (meta?._id !== this.meta) { return false; }
    if (round?._id !== this.round) { return false; }
    const parent = meta || round;
    const myIndex = parent.puzzles.indexOf(myId);
    const itsIndex = parent.puzzles.indexOf(this.id);
    const diff = itsIndex - myIndex;
    const rect = target.getBoundingClientRect();
    let args = null;
    if ((clientY - rect.top) < this.fromTop) {
      if (diff === -1) { return true; }
      args = {before: myId};
    } else if ((rect.bottom - clientY) < this.fromBottom) {
      if (diff === 1) { return true; }
      args = {after: myId};
    } else if (diff > 1) {
      args = {after: myId};
    } else if (diff < -1) {
      args = {before: myId};
    } else {
      return true;
    }
    if (meta != null) {
      Meteor.call('moveWithinMeta', this.id, meta._id, args);
    } else if (round != null) {
      Meteor.call('moveWithinRound', this.id, round._id, args);
    }
    return true;
  }
}
