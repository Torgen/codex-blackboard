// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
Template.favorite.helpers({
  favorite() { return this.favorites?.[Meteor.userId()]; }});

Template.favorite.events({
  'click .favorite'(event, template) { return Meteor.call('unfavorite', this._id); },
  'click .indifferent'(event, template) { return Meteor.call('favorite', this._id); }
});
