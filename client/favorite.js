Template.favorite.helpers({
  favorite() {
    return this.favorites?.[Meteor.userId()];
  },
});

Template.favorite.events({
  "click .favorite"(event, template) {
    Meteor.call("unfavorite", this._id);
  },
  "click .indifferent"(event, template) {
    Meteor.call("favorite", this._id);
  },
});
