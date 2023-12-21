import { Names } from "/lib/imports/collections.js";

Template.link.onCreated(function () {
  this.target = new ReactiveVar(null);
  this.autorun(() => {
    this.target.set(Names.findOne(Template.currentData().id));
  });
});

Template.link.helpers({
  target() {
    return Template.instance().target.get();
  },
  text() {
    return (
      Template.instance().data.text ?? Template.instance().target.get()?.name
    );
  }
});
