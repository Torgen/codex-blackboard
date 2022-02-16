import './edit_tag_name.html'
import './edit_tag_name.less'

import canonical from '/lib/imports/canonical.coffee'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'

Template.edit_tag_name.onCreated ->
  @newTagName = new ReactiveVar @data.name
  @editing = new ReactiveVar false

Template.edit_tag_name.events
  'input/focus input': (event, template) ->
    template.newTagName.set event.currentTarget.value
  'click .bb-editable': (event, template) ->
    template.editing.set true
    Tracker.afterFlush ->
      template.$('input').focus()

Template.edit_tag_name.events okCancelEvents 'input',
  ok: (val, evt, tem) ->
    return unless tem.editing.get()
    # strip leading/trailing whitespace from text (cancel if text is empty)
    val = val.replace /^\s+|\s+$/, ''
    if val
      thing = share.model.collection(tem.data.type).findOne(tem.data.id)
      canon = canonical @name
      newCanon = canonical(val)
      if newCanon isnt canon and thing.tags[newCanon]?
        return
      Meteor.call 'renameTag', {type:tem.data.type, object:tem.data.id, old_name:tem.data.name, new_name: val}
    tem.editing.set false
  cancel: (evt, tem) ->
    tem.editing.set false

Template.edit_tag_name.helpers
  tagEditClass: ->
    val = Template.instance().newTagName.get()
    return 'error' if not val
    cval = canonical val
    return 'info' if cval is canonical @name
    return 'error' if share.model.collection(@type).findOne(_id: @id).tags[cval]?
    return 'success'
  tagEditStatus: ->
    val = Template.instance().newTagName.get()
    return 'Cannot be empty' if not val
    return 'Unchanged' if val is @name
    return 'Tag already exists' if share.model.collection(@type).findOne(_id: @id).tags[canonical val]?
  canon: -> canonical @name
  editing: -> Template.instance().editing.get()
