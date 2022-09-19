import './edit_field.html'
import { collection } from '/lib/imports/collections.coffee'
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee'

editableTemplate Template.edit_field,
  ok: (value, evt, tem) ->
    if value isnt collection(tem.data.type).findOne(tem.data.id)?[tem.data.field]
      Meteor.call 'setField',
        type: tem.data.type
        object: tem.data.id
        fields:
          [tem.data.field]: value

Template.edit_field.helpers
  value: -> collection(@type).findOne(_id: @id)?[@field] ? ''