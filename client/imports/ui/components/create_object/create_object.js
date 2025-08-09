import "./create_object.html";
import canonical from "/lib/imports/canonical.js";
import { collection, pretty_collection } from "/lib/imports/collections.js";
import okCancelEvents from "/client/imports/ok_cancel_events.js";

Template.create_object.onCreated(function () {
  this.name = new ReactiveVar("");
});

Template.create_object.onRendered(function () {
  this.$("input").focus();
});

Template.create_object.events({
  "focus/input input"(event, template) {
    template.name.set(event.currentTarget.value);
  },
});

function ok(name, evt, template) {
  if (evt.type == "focusout" && template.data.clickToCommit) {
    return;
  }
  if (!this.done.done()) {
    return;
  }
  let type = pretty_collection(template.data.type);
  type = type[0].toUpperCase() + type.slice(1);
  Meteor.serializeCall(`new${type}`, { name, ...this.params });
  template.name.set("");
}

Template.create_object.events(
  okCancelEvents("input", {
    cancel(evt, template) {
      if (evt.type == "focusout" && template.data.clickToCommit) {
        return;
      }
      this.done.done();
    },
    ok,
  })
);

Template.create_object.events({
  "click .commit"(evt, template) {
    ok.apply(this, [template.name.get(), evt, template]);
  },
});

Template.create_object.helpers({
  pretty() {
    return pretty_collection(this.type);
  },
  upperPretty() {
    const type = pretty_collection(this.type);
    return type[0].toUpperCase() + type.slice(1);
  },
  titleAddClass() {
    const val = Template.instance().name.get();
    if (!val) {
      return "error";
    }
    const cval = canonical(val);
    if (collection(this.type).findOne({ canon: cval }) != null) {
      return "error";
    }
    return "success";
  },
  titleAddStatus() {
    const val = Template.instance().name.get();
    if (!val) {
      return "Cannot be empty";
    }
    const cval = canonical(val);
    if (collection(this.type).findOne({ canon: cval }) != null) {
      return `Conflicts with another ${pretty_collection(this.type)}`;
    }
  },
});
