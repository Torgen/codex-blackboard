// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './edit_field.html';
import { collection } from '/lib/imports/collections.js';
import { editableTemplate } from '/client/imports/ok_cancel_events.js';

editableTemplate(Template.edit_field, {
  ok(value, evt, tem) {
    if (value !== collection(tem.data.type).findOne(tem.data.id)?.[tem.data.field]) {
      return Meteor.call('setField', {
        type: tem.data.type,
        object: tem.data.id,
        fields: {
          [tem.data.field]: value
        }
      }
      );
    }
  }
}
);

Template.edit_field.helpers({
  value() { return collection(this.type).findOne({_id: this.id})?.[this.field] ?? ''; }});