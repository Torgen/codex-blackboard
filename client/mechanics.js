// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import {mechanics} from '../lib/imports/mechanics.js';

Template.registerHelper('yourFavoriteMechanic', function() {
  return Meteor.user().favorite_mechanics?.includes(this);
});

Template.registerHelper('mechanicName', function() {
  return mechanics[this].name;
});

Template.mechanics.helpers({
  mechanics() { return (() => {
    const result = [];
    for (let c in mechanics) {
      const mech = mechanics[c];
      result.push(mech);
    }
    return result;
  })(); },
  isChecked() { return Template.instance().data?.includes(this.canon); }
});

Template.mechanics.events({
  'click li a'(event, template) {
    // Stop the dropdown from closing.
    return event.stopPropagation();
  }
});

Template.puzzle_mechanics.events({
  'change input[data-mechanic]'(event, template) {
    const method = event.currentTarget.checked ? 'addMechanic' : 'removeMechanic';
    return Meteor.call(method, template.data._id, event.currentTarget.dataset.mechanic);
  }
});

Template.favorite_mechanics.events({
  'change input[data-mechanic]'(event, template) {
    const method = event.currentTarget.checked ? 'favoriteMechanic' : 'unfavoriteMechanic';
    return Meteor.call(method, event.currentTarget.dataset.mechanic);
  }
});
