// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './fix_puzzle_drive.html';

import { Puzzles } from '/lib/imports/collections.coffee';

Template.fix_puzzle_drive.helpers({
  puzzle() { return Puzzles.findOne({_id: this.puzzle}, {fields: {drive: 1, drive_status: 1}}); }});

Template.fix_puzzle_drive.events({
  'click .bb-fix-drive'(event, template) {
    event.preventDefault(); // keep .bb-editable from being processed!
    event.stopPropagation(); // keep .bb-editable from being processed!
    return Meteor.call('fixPuzzleFolder', {
      object: this.puzzle,
      name: Puzzles.findOne({_id: this.puzzle}).name
    }
    );
  }
});
