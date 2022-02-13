'use strict'
import './edit_tag_value.html'
import { confirm } from '/client/imports/modal.coffee'
import { cssColorToHex, hexToCssColor } from '/client/imports/objectColor.coffee'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'

Template.edit_tag_value.onCreated ->
  @editing = new ReactiveVar false

Template.edit_tag_value.helpers
  editing: -> Template.instance().editing.get()
  hexify: (v) -> cssColorToHex v

Template.edit_tag_value.events
  'click input[type="color"]': (event, template) ->
    event.stopPropagation()
  'input input[type="color"]': (event, template) ->
    text = hexToCssColor event.currentTarget.value
    Meteor.call 'setTag', {type:template.data.type, object:template.data.id, name:template.data.name, value:text}
  'click .bb-editable': (event, template) ->
    template.editing.set true
    Tracker.afterFlush ->
      template.$('input[type="text"]').focus()
  'click .bb-delete-icon': (event, template) ->
    event.stopPropagation()
    message = "Are you sure you want to delete the #{template.data.name}?"
    if (await confirm
      ok_button: 'Yes, delete it'
      no_button: 'No, cancel'
      message: message)
      Meteor.call 'deleteTag', {type: template.data.type, object: template.data.id, name: template.data.name}

Template.edit_tag_value.events okCancelEvents 'input[type="text"]',
  ok: (value, evt, tem) -> 
    return unless tem.editing.get()
    # strip leading/trailing whitespace from text
    value = value.replace /^\s+|\s+$/, ''
    if value isnt tem.data.value
      Meteor.call 'setTag', {type: tem.data.type, object: tem.data.id, name: tem.data.name, value}
    tem.editing.set false
  cancel: (evt, tem) ->
    tem.editing.set false
