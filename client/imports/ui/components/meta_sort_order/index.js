import "./meta_sort_order.html";

Template.meta_sort_order.events({
  "click button[data-sort-order]"(event, template) {
    Meteor.serializeCall("setField", {
      type: "puzzles",
      object: template.data._id,
      fields: { order_by: event.currentTarget.dataset.sortOrder },
    });
  },
});
