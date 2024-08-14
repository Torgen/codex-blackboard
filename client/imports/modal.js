Template.confirmmodal.onCreated(function () {
  this.result = this.data.onCancel;
});
Template.confirmmodal.onRendered(function () {
  this.$("#confirmModal .bb-confirm-cancel").focus();
  this.$("#confirmModal").modal({ show: true });
});
Template.confirmmodal.events({
  "click .bb-confirm-ok"(event, template) {
    template.result = template.data.onConfirm;
    template.$("#confirmModal").modal("hide");
  },
  "hidden *"(event, template) {
    template.result();
  },
});

export function confirm (data) {
  currentConfirmation = new Promise(function (resolve) {
    let view = null;
    const onCancel = function () {
      Blaze.remove(view);
      resolve(false);
    };
    const onConfirm = function () {
      Blaze.remove(view);
      resolve(true);
    };
    view = Blaze.renderWithData(
      Template.confirmmodal,
      { ...data, onCancel, onConfirm },
      document.body
    );
  });
  return currentConfirmation;
}

// Visible for testing
export var currentConfirmation;
