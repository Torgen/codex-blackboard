import './edit_object_title.html'
import canonical from '/lib/imports/canonical.coffee'
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee'

editableTemplate Template.edit_object_title,
  ok: (val, evt, tem) ->
    type = share.model.pretty_collection(tem.data.type)
    type = type[0].toUpperCase() + type.slice(1)
    if val isnt share.model.collection(tem.data.type).findOne(tem.data.id).name
      Meteor.call "rename#{type}",
        id: tem.data.id
        name: val

Template.edit_object_title.onCreated ->
  @value = new ReactiveVar ''

Template.edit_object_title.events
  'input/focus input': (event, template) ->
    template.value.set event.currentTarget.value
  
Template.edit_object_title.helpers
  name: -> share.model.collection(@type).findOne(@id).name
  pretty: -> share.model.pretty_collection(@type)
  titleEditClass: ->
    val = Template.instance().value.get()
    return 'error' if not val
    cval = canonical val
    return 'info' if cval is share.model.collection(@type).findOne(@id).canon
    return 'error' if share.model.collection(@type).findOne(canon: cval)?
    return 'success'
  titleEditStatus: ->
    val = Template.instance().value.get()
    return 'Cannot be empty' if not val
    return 'Unchanged' if val is share.model.collection(@type).findOne(@id).name
    cval = canonical val
    return if cval is share.model.collection(@type).findOne(@id).canon
    return "Conflicts with another #{share.model.pretty_collection(@type)}" if share.model.collection(@type).findOne(canon: cval)?
