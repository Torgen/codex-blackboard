import { Puzzles } from "/lib/imports/collections.js";

export default class PuzzleFeed {
  constructor(field, update, query = {}) {
    this.field = field;
    this.update = update;
    this.data = [];
    this.hasNow = new ReactiveVar(false);
    this.query = query;
  }

  updateNow() {
    if (this._updateNow()) {
      this.update();
    }
  }

  _updateNow() {
    const time = Session.get("currentTime");
    if (this.hasNow.get()) {
      if (time > this.data.at(-1).x) {
        this.data.at(-1).x = time;
        return true;
      }
    } else {
      if (!this.data.length || this.data.at(-1).x <= time) {
        this.hasNow.set(true);
        this.data.push({ x: time, y: this.data.length });
        return true;
      }
    }
    return false;
  }

  maybePopNow() {
    if (this.hasNow.get() && this.data.at(-2).x > this.data.at(-1).x) {
      this.hasNow.set(false);
      this.data.pop();
    }
  }

  addedAt(doc, ix) {
    this.data.splice(ix, 0, { x: doc[this.field], y: ix + 1 });
    while (++ix < this.data.length) {
      this.data[ix].y++;
    }
    Tracker.nonreactive(() => {
      if (this.data.length > 1) {
        this.maybePopNow();
      }
    });
    this.update();
  }

  changedAt(newDoc, oldDoc, ix) {
    this.data[ix].x = newDoc[this.field];
    Tracker.nonreactive(() => {
      if (ix === this.data.length - 2) {
        this.maybePopNow();
      }
    });
    this.update();
  }

  removedAt(doc, ix) {
    this.data.splice(ix, 1);
    while (++ix < this.data.length) {
      this.data[ix].y--;
    }
    Tracker.nonreactive(() => this._updateNow());
    this.update();
  }

  observe() {
    return Puzzles.find(
      { [this.field]: { $ne: null }, ...this.query },
      { fields: { [this.field]: 1 }, sort: { [this.field]: 1 } },
    ).observe({
      addedAt: this.addedAt.bind(this),
      changedAt: this.changedAt.bind(this),
      removedAt: this.removedAt.bind(this),
    });
  }
}
