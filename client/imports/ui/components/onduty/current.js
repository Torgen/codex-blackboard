// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import './current.html';

import { Roles } from '/lib/imports/collections.js';

Template.onduty_current.helpers({
  onduty() { return Roles.findOne('onduty'); }});
