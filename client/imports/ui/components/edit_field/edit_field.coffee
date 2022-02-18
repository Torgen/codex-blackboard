import './edit_field.html'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'

Template.edit_field.onCreated ->
  @editing = new ReactiveVar false

Template.edit_field.events
  'click .bb-edit-field': (evt, template) ->
    template.editing.set true
    Tracker.afterFlush ->
      template.$('input').focus()
  
Template.edit_field.events okCancelEvents 'input',
  ok: (value, evt, tem) -> 
    return unless tem.editing.get()
    tem.editing.set false
    # strip leading/trailing whitespace from text
    value = value.replace /^\s+|\s+$/, ''
    if value isnt share.model.collection(tem.data.type).findOne(tem.data.id)?[tem.data.field]
      Meteor.call 'setField',
        type: tem.data.type
        object: tem.data.id
        fields:
          [tem.data.field]: value
  cancel: (evt, tem) ->
    tem.editing.set false

Template.edit_field.helpers
  editing: -> Template.instance().editing.get()
  value: -> share.model.collection(@type).findOne(_id: @id)?[@field] ? ''