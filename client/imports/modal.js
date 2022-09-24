/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
Template.confirmmodal.onCreated(function() {
  return this.result = this.data.onCancel;
});
Template.confirmmodal.onRendered(function() {
  this.$('#confirmModal .bb-confirm-cancel').focus();
  return this.$('#confirmModal').modal({show: true});
});
Template.confirmmodal.events({
  "click .bb-confirm-ok"(event, template) {
    template.result = template.data.onConfirm;
    return template.$('#confirmModal').modal('hide');
  },
  'hidden *'(event, template) { 
    return template.result();
  }
});

export var confirm = data => new Promise(function(resolve) {
  let view = null;
  const onCancel = function() {
    Blaze.remove(view);
    return resolve(false);
  };
  const onConfirm = function() {
    Blaze.remove(view);
    return resolve(true);
  };
  return view = Blaze.renderWithData(Template.confirmmodal, {...data, onCancel, onConfirm}, document.body);
});
