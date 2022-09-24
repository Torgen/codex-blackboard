// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './edit_tag_value.html';

import canonical from '/lib/imports/canonical.coffee';
import { collection } from '/lib/imports/collections.coffee';
import { confirm } from '/client/imports/modal.coffee';
import { cssColorToHex, hexToCssColor } from '/client/imports/objectColor.coffee';
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee';


editableTemplate(Template.edit_tag_value, {
  ok(value, evt, tem) {
    if (value !== collection(tem.data.type).findOne(tem.data.id)?.tags[canonical(tem.data.name)]?.value) {
      return Meteor.call('setTag', {type: tem.data.type, object: tem.data.id, name: tem.data.name, value});
    }
  }
});

Template.edit_tag_value.helpers({
  canon() { return canonical(this.name); },
  value() { return collection(this.type).findOne({_id: this.id})?.tags[canonical(this.name)]?.value ?? ''; },
  exists() { return (collection(this.type).findOne({_id: this.id})?.tags[canonical(this.name)] != null); },
  hexify(v) { return cssColorToHex(v); }
});

Template.edit_tag_value.events({
  'click input[type="color"]'(event, template) {
    return event.stopPropagation();
  },
  'input input[type="color"]'(event, template) {
    const text = hexToCssColor(event.currentTarget.value);
    return Meteor.call('setTag', {type:template.data.type, object:template.data.id, name:template.data.name, value:text});
  },
  async 'click .bb-delete-icon'(event, template) {
    event.stopPropagation();
    const message = `Are you sure you want to delete the ${template.data.name} of ${collection(template.data.type).findOne(template.data.id).name}?`;
    if (await confirm({
      ok_button: 'Yes, delete it',
      no_button: 'No, cancel',
      message
    })) {
      return Meteor.call('deleteTag', {type: template.data.type, object: template.data.id, name: template.data.name});
    }
  }});
