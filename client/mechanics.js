import { mechanics } from "/lib/imports/mechanics.js";
import floatingDropdown from "/client/imports/ui/mixins/floating_dropdown";

Template.registerHelper("yourFavoriteMechanic", function () {
  return Meteor.user().favorite_mechanics?.includes(this);
});

Template.registerHelper("mechanicName", function () {
  return mechanics[this].name;
});

Template.mechanics.helpers({
  mechanics() {
    return Object.values(mechanics);
  },
  isChecked() {
    return Template.instance().data?.includes(this.canon);
  },
});

floatingDropdown(Template.mechanics);

Template.mechanics.events({
  "click li a"(event, template) {
    // Stop the dropdown from closing.
    event.stopPropagation();
  },
});

Template.puzzle_mechanics.events({
  "change input[data-mechanic]"(event, template) {
    const method = event.currentTarget.checked
      ? "addMechanic"
      : "removeMechanic";
    Meteor.serializeCall(
      method,
      template.data._id,
      event.currentTarget.dataset.mechanic
    );
  },
});

Template.favorite_mechanics.events({
  "change input[data-mechanic]"(event, template) {
    const method = event.currentTarget.checked
      ? "favoriteMechanic"
      : "unfavoriteMechanic";
    Meteor.serializeCall(method, event.currentTarget.dataset.mechanic);
  },
});
