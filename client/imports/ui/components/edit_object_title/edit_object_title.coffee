import './edit_object_title.html'
import './edit_object_title.less'
import canonical from '/lib/imports/canonical.coffee'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'

Template.edit_puzzle_title.onCreated ->
  @editing = new ReactiveVar false
  @value = new ReactiveVar ''

Template.edit_puzzle_title.events
  'click .bb-editable': (event, template) ->
    template.editing.set true
    Tracker.afterFlush -> template.$('input').focus()
  'input/focus input': (event, template) ->
    template.value.set event.currentTarget.value

Template.edit_puzzle_title.events okCancelEvents 'input',
  ok: (val, evt, tem) ->
    return unless tem.editing.get()
    tem.editing.set false
    if val isnt share.model.Puzzles.findOne(tem.data.id).name
      Meteor.call 'renamePuzzle',
        id: tem.data.id
        name: val
  cancel: (evt, tem) ->
    tem.editing.set false
  
Template.edit_puzzle_title.helpers
  name: -> share.model.Puzzles.findOne(@id).name
  editing: -> Template.instance().editing.get()
  titleEditClass: ->
    val = Template.instance().value.get()
    return 'error' if not val
    cval = canonical val
    return 'success' if cval is share.model.Puzzles.findOne(@id).canon
    return 'error' if share.model.Puzzles.findOne(canon: cval)?
    return 'success'
  titleEditStatus: ->
    val = Template.instance().value.get()
    return 'Cannot be empty' if not val
    return 'Unchanged' if val is share.model.Puzzles.findOne(@id).name
    cval = canonical val
    return if cval is share.model.Puzzles.findOne(@id).canon
    return 'Conflicts with another puzzle' if share.model.Puzzles.findOne(canon: cval)?
