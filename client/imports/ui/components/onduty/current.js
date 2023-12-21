import "./current.html";

import { Roles } from "/lib/imports/collections.js";

Template.onduty_current.helpers({
  onduty() {
    return Roles.findOne("onduty");
  },
});
