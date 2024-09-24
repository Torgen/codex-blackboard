Template.favorite.helpers({
  favorite() {
    return this.favorites?.[Meteor.userId()];
  },
});

Template.favorite.events({
  "click .favorite"(event, template) {
    Meteor.serializeCall("unfavorite", this._id);
  },
  "click .indifferent"(event, template) {
    Meteor.serializeCall("favorite", this._id);
  },
});
