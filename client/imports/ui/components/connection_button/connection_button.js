import "./connection_button.html";

Template.connection_button.helpers({
  connectStatus: Meteor.status
});

Template.connection_button.events({
  "click .connected, click .connecting, click .waiting"(event, template) {
    Meteor.disconnect();
  },
  "click .failed, click .offline"(event, template) {
    Meteor.reconnect();
  }
});
