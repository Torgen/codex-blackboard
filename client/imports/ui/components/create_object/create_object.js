// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './create_object.html';
import canonical from '/lib/imports/canonical.js';
import { collection, pretty_collection } from '/lib/imports/collections.js';
import okCancelEvents from '/client/imports/ok_cancel_events.js';

Template.create_object.onCreated(function() {
  return this.name = new ReactiveVar('');
});

Template.create_object.onRendered(function() {
  return this.$('input').focus();
});

Template.create_object.events({
  'focus/input input'(event, template) {
    return template.name.set(event.currentTarget.value);
  }
});

Template.create_object.events(okCancelEvents('input', {
  cancel(evt, template) { return this.done.done(); },
  ok(name, evt, template) {
    if (!this.done.done()) { return; }
    let type = pretty_collection(template.data.type);
    type = type[0].toUpperCase() + type.slice(1);
    Meteor.call(`new${type}`, {name, ...this.params});
    return template.name.set('');
  }
}
)
);

Template.create_object.helpers({
  pretty() { return pretty_collection(this.type); },
  upperPretty() {
    const type = pretty_collection(this.type);
    return type[0].toUpperCase() + type.slice(1);
  },
  titleAddClass() {
    const val = Template.instance().name.get();
    if (!val) { return 'error'; }
    const cval = canonical(val);
    if (collection(this.type).findOne({canon: cval}) != null) { return 'error'; }
    return 'success';
  },
  titleAddStatus() {
    const val = Template.instance().name.get();
    if (!val) { return 'Cannot be empty'; }
    const cval = canonical(val);
    if (collection(this.type).findOne({canon: cval}) != null) { return `Conflicts with another ${pretty_collection(this.type)}`; }
  }
});
