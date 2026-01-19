import "./index.html";

const ROLES = {
  onduty: {
    icon: "pager",
    tooltip: "On Duty - Responsible for call-ins and adding puzzles",
  },
  serveroperator: {
    // The only way to get this is with direct database manipulation.
    icon: "server",
    tooltip: "Server Operator - Has shell access to server and database",
  },
};

Template.nick_roles.helpers({
  nick_roles(nick) {
    return Meteor.users.findOne({ _id: nick })?.roles || [];
  },
  role_data(role) {
    return ROLES[role];
  },
});
