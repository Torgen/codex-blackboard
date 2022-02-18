import './edit_tag_name.html'

import canonical from '/lib/imports/canonical.coffee'
import { editableTemplate } from '/client/imports/ok_cancel_events.coffee'

editableTemplate Template.edit_tag_name,
  ok: (val, evt, tem) ->
    if val
      thing = share.model.collection(tem.data.type).findOne(tem.data.id)
      canon = canonical @name
      newCanon = canonical(val)
      if newCanon isnt canon and thing.tags[newCanon]?
        return
      Meteor.call 'renameTag', {type:tem.data.type, object:tem.data.id, old_name:tem.data.name, new_name: val}

Template.edit_tag_name.onCreated ->
  @newTagName = new ReactiveVar @data.name

Template.edit_tag_name.events
  'input/focus input': (event, template) ->
    template.newTagName.set event.currentTarget.value

Template.edit_tag_name.helpers
  tagEditClass: ->
    val = Template.instance().newTagName.get()
    return 'error' if not val
    cval = canonical val
    return 'info' if val is @name
    return 'success' if cval is canonical @name
    return 'error' if share.model.collection(@type).findOne(_id: @id).tags[cval]?
    return 'success'
  tagEditStatus: ->
    val = Template.instance().newTagName.get()
    return 'Cannot be empty' if not val
    return 'Unchanged' if val is @name
    cval = canonical val
    return if cval is canonical @name
    return 'Tag already exists' if share.model.collection(@type).findOne(_id: @id).tags[cval]?
  canon: -> canonical @name
