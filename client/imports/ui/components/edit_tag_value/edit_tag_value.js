import "./edit_tag_value.html";

import canonical from "/lib/imports/canonical.js";
import { collection } from "/lib/imports/collections.js";
import { confirm } from "/client/imports/modal.js";
import { cssColorToHex, hexToCssColor } from "/client/imports/objectColor.js";
import { editableTemplate } from "/client/imports/ok_cancel_events.js";

editableTemplate(Template.edit_tag_value, {
  ok(value, evt, tem) {
    if (
      value !==
      collection(tem.data.type).findOne(tem.data.id)?.tags?.[
        canonical(tem.data.name)
      ]?.value
    ) {
      Meteor.call("setTag", {
        type: tem.data.type,
        object: tem.data.id,
        name: tem.data.name,
        value,
      });
    }
  },
});

Template.edit_tag_value.helpers({
  canon() {
    return canonical(this.name);
  },
  value() {
    return (
      collection(this.type).findOne({ _id: this.id })?.tags?.[
        canonical(this.name)
      ]?.value ?? ""
    );
  },
  exists() {
    return (
      collection(this.type).findOne({ _id: this.id })?.tags?.[
        canonical(this.name)
      ] != null
    );
  },
  hexify(v) {
    return cssColorToHex(v);
  },
});

Template.edit_tag_value.events({
  "click a"(event, template) {
    event.stopPropagation();
  },
  'click input[type="color"]'(event, template) {
    event.stopPropagation();
  },
  'input input[type="color"]'(event, template) {
    const text = hexToCssColor(event.currentTarget.value);
    Meteor.call("setTag", {
      type: template.data.type,
      object: template.data.id,
      name: template.data.name,
      value: text,
    });
  },
  async "click .bb-delete-icon"(event, template) {
    event.stopPropagation();
    const message = `Are you sure you want to delete the ${
      template.data.name
    } of ${collection(template.data.type).findOne(template.data.id).name}?`;
    if (
      await confirm({
        ok_button: "Yes, delete it",
        no_button: "No, cancel",
        message,
      })
    ) {
      Meteor.call("deleteTag", {
        type: template.data.type,
        object: template.data.id,
        name: template.data.name,
      });
    }
  },
});
