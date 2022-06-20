'use strict'
import './edit_tag_value.html'

import canonical from '/lib/imports/canonical.coffee'
import { confirm } from '/client/imports/modal.coffee'
import { cssColorToHex, hexToCssColor } from '/client/imports/objectColor.coffee'
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee'


editableTemplate Template.edit_tag_value,
  ok: (value, evt, tem) ->
    if value isnt share.model.collection(tem.data.type).findOne(tem.data.id)?.tags[canonical tem.data.name]?.value
      Meteor.call 'setTag', {type: tem.data.type, object: tem.data.id, name: tem.data.name, value}

Template.edit_tag_value.helpers
  canon: -> canonical @name
  value: -> share.model.collection(@type).findOne(_id: @id)?.tags[canonical @name]?.value ? ''
  exists: -> share.model.collection(@type).findOne(_id: @id)?.tags[canonical @name]?
  hexify: (v) -> cssColorToHex v

Template.edit_tag_value.events
  'click input[type="color"]': (event, template) ->
    event.stopPropagation()
  'input input[type="color"]': (event, template) ->
    text = hexToCssColor event.currentTarget.value
    Meteor.call 'setTag', {type:template.data.type, object:template.data.id, name:template.data.name, value:text}
  'click .bb-delete-icon': (event, template) ->
    event.stopPropagation()
    message = "Are you sure you want to delete the #{template.data.name} of #{share.model.collection(template.data.type).findOne(template.data.id).name}?"
    if (await confirm
      ok_button: 'Yes, delete it'
      no_button: 'No, cancel'
      message: message)
      Meteor.call 'deleteTag', {type: template.data.type, object: template.data.id, name: template.data.name}
