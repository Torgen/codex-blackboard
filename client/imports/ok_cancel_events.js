export function editableTemplate(template, callbacks) {
  template.onCreated(function () {
    this.editable = new ReactiveVar(false);
  });

  template.events({
    "click/bb-edit .bb-editable"(evt, t) {
      t.editable.set(true);
      Tracker.afterFlush(() => t.$('input[type="text"]').focus());
    },
  });

  template.events(
    okCancelEvents('input[type="text"]', {
      ok(v, e, t) {
        if (!t.editable.get()) {
          return;
        }
        t.editable.set(false);
        v = v.replace(/^\s+|\s+$/, "");
        callbacks.ok?.(v, e, t);
      },
      cancel(e, t) {
        t.editable.set(false);
        callbacks.cancel?.(e, t);
      },
    }),
  );

  template.helpers({
    editing() {
      return Template.instance().editable.get();
    },
  });
}

// Returns an event map that handles the "escape" and "return" keys and
// "blur" events on a text input (given by selector) and interprets them
// as "ok" or "cancel".
// (Borrowed from Meteor 'todos' example.)
function okCancelEvents(selector, callbacks) {
  const ok = callbacks.ok || function () {};
  const cancel = callbacks.cancel || function () {};
  const evspec = ["keyup", "keydown", "focusout"].map(
    (ev) => `${ev} ${selector}`,
  );
  const events = {};
  events[evspec.join(", ")] = function (evt, template) {
    if (evt.type === "keydown" && evt.which === 27) {
      // escape = cancel
      return cancel.call(this, evt, template);
      // tab would cause focusout, but we want to handle it specially.
    } else if (
      (evt.type === "keyup" && evt.which === 13) ||
      (evt.type === "keydown" && evt.which === 9) ||
      evt.type === "focusout"
    ) {
      // blur/return/enter = ok/submit if non-empty
      const value = String(evt.target.value || "");
      if (value) {
        return ok.call(this, value, evt, template);
      } else {
        return cancel.call(this, evt, template);
      }
    }
  };
  return events;
}

export default okCancelEvents;
