'use strict'

export editableTemplate = (template, callbacks) ->
  template.onCreated ->
    @editable = new ReactiveVar false

  template.events
    'click/bb-edit .bb-editable': (evt, t) ->
      t.editable.set true
      Tracker.afterFlush ->
        t.$('input[type="text"]').focus()

  template.events okCancelEvents 'input[type="text"]',
    ok: (v, e, t) ->
      return unless t.editable.get()
      t.editable.set false
      v = v.replace /^\s+|\s+$/, ''
      callbacks.ok?(v, e, t)
    cancel: (e, t) ->
      t.editable.set false
      callbacks.cancel?(e, t)

  template.helpers
    editing: -> Template.instance().editable.get()

# Returns an event map that handles the "escape" and "return" keys and
# "blur" events on a text input (given by selector) and interprets them
# as "ok" or "cancel".
# (Borrowed from Meteor 'todos' example.)
export default okCancelEvents = (selector, callbacks) ->
  ok = callbacks.ok or (->)
  cancel = callbacks.cancel or (->)
  evspec = ("#{ev} #{selector}" for ev in ['keyup','keydown','focusout'])
  events = {}
  events[evspec.join(', ')] = (evt, template) ->
    console.log event.type, event.which
    if evt.type is "keydown" and evt.which is 27
      # escape = cancel
      cancel.call this, evt, template
    # tab would cause focusout, but we want to handle it specially.
    else if evt.type is "keyup" and evt.which is 13 or evt.type is 'keydown' and evt.which is 9 or evt.type is "focusout"
      # blur/return/enter = ok/submit if non-empty
      value = String(evt.target.value or "")
      if value
        ok.call this, value, evt, template
      else
        cancel.call this, evt, template
  events
