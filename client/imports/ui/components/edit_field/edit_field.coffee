import './edit_field.html'
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee'

editableTemplate Template.edit_field,
  ok: (value, evt, tem) ->
    if value isnt share.model.collection(tem.data.type).findOne(tem.data.id)?[tem.data.field]
      Meteor.call 'setField',
        type: tem.data.type
        object: tem.data.id
        fields:
          [tem.data.field]: value

Template.edit_field.helpers
  value: -> share.model.collection(@type).findOne(_id: @id)?[@field] ? ''