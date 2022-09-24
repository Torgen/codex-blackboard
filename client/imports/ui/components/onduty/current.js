import './current.html';

import { Roles } from '/lib/imports/collections.coffee';

Template.onduty_current.helpers({
  onduty() { return Roles.findOne('onduty'); }});
