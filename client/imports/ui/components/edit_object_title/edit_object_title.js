import "./edit_object_title.html";
import canonical from "/lib/imports/canonical.js";
import { collection, pretty_collection } from "/lib/imports/collections.js";
import { editableTemplate } from "/client/imports/ok_cancel_events.js";

editableTemplate(Template.edit_object_title, {
  ok(val, evt, tem) {
    let type = pretty_collection(tem.data.type);
    type = type[0].toUpperCase() + type.slice(1);
    if (val !== collection(tem.data.type).findOne(tem.data.id).name) {
      Meteor.call(`rename${type}`, {
        id: tem.data.id,
        name: val,
      });
    }
  },
});

Template.edit_object_title.onCreated(function () {
  this.value = new ReactiveVar("");
});

Template.edit_object_title.events({
  "input/focus input"(event, template) {
    template.value.set(event.currentTarget.value);
  },
});

Template.edit_object_title.helpers({
  name() {
    return collection(this.type).findOne(this.id)?.name;
  },
  pretty() {
    return pretty_collection(this.type);
  },
  titleEditClass() {
    const val = Template.instance().value.get();
    if (!val) {
      return "error";
    }
    const cval = canonical(val);
    if (cval === collection(this.type).findOne(this.id).canon) {
      return "info";
    }
    if (collection(this.type).findOne({ canon: cval }) != null) {
      return "error";
    }
    return "success";
  },
  titleEditStatus() {
    const val = Template.instance().value.get();
    if (!val) {
      return "Cannot be empty";
    }
    if (val === collection(this.type).findOne(this.id).name) {
      return "Unchanged";
    }
    const cval = canonical(val);
    if (cval === collection(this.type).findOne(this.id).canon) {
      return;
    }
    if (collection(this.type).findOne({ canon: cval }) != null) {
      return `Conflicts with another ${pretty_collection(this.type)}`;
    }
  },
});
