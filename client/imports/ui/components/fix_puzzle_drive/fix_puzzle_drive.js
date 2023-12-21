import "./fix_puzzle_drive.html";

import { Puzzles } from "/lib/imports/collections.js";

Template.fix_puzzle_drive.helpers({
  puzzle() {
    return Puzzles.findOne(
      { _id: this.puzzle },
      { fields: { drive: 1, drive_status: 1 } }
    );
  },
});

Template.fix_puzzle_drive.events({
  "click .bb-fix-drive"(event, template) {
    event.preventDefault(); // keep .bb-editable from being processed!
    event.stopPropagation(); // keep .bb-editable from being processed!
    Meteor.call("fixPuzzleFolder", {
      object: this.puzzle,
      name: Puzzles.findOne({ _id: this.puzzle }).name,
    });
  },
});
