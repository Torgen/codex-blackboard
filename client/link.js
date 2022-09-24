// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Names } from '/lib/imports/collections.coffee';

Template.link.onCreated(function() {
  this.target = new ReactiveVar(null);
  return this.autorun(() => {
    return this.target.set(Names.findOne(Template.currentData().id));
  });
});

Template.link.helpers({
  target() { return Template.instance().target.get(); },
  text() { return Template.instance().data.text ?? Template.instance().target.get()?.name; }
});
