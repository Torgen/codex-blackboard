'use strict'

model = share.model

import canonical from '/lib/imports/canonical.coffee'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'
import './tag_table_rows.html'
import '../edit_tag_name/edit_tag_name.coffee'
import '../edit_tag_value/edit_tag_value.coffee'

Template.tag_table_rows.onCreated ->
  @newTagName = new ReactiveVar ''
  @autorun =>
    if Template.currentData().adding.adding()
      Tracker.afterFlush =>
        @$('.bb-add-tag input').focus()
    else
      @newTagName.set ''

Template.tag_table_rows.events
  'input/focus .bb-add-tag input': (event, template) ->
    template.newTagName.set event.currentTarget.value

Template.tag_table_rows.events okCancelEvents '.bb-add-tag input',
  ok: (value, event, template) ->
    return unless @adding.adding()
    @adding.done()
    template.newTagName.set ''
    cval = canonical value
    return if model.collection(@type).findOne(_id: @id).tags[cval]?
    Meteor.call 'setTag', {type: @type, object: @id, name: value, value: ''}
    # simulation is enough for us to start editing the value if the event was enter or tab
    if event.which in [9,13]
      Tracker.afterFlush ->
        template.$("tr[data-tag-name='#{cval}'] .bb-edit-tag-value").trigger 'bb-edit'

  cancel: (event, template) ->
    @adding.done()
    template.newTagName.set ''

Template.tag_table_rows.helpers
  tags: ->
    tags = model.collection(@type).findOne({_id: @id}, {fields: tags: 1})?.tags or {}
    (
      t = tags[canon]
      res = { _id: "#{@id}/#{canon}", name: t.name, canon, value: t.value, touched_by: t.touched_by }
    ) for canon in Object.keys(tags).sort() when not \
      ((Session.equals('currentPage', 'blackboard') and \
        (canon is 'status' or \
            (@type isnt 'rounds' and canon is 'answer'))) or \
        ((canon is 'answer' or canon is 'backsolve') and \
        (Session.equals('currentPage', 'puzzle') or Session.equals('currentPage', 'logistics_page'))))
  tagAddClass: ->
    val = Template.instance().newTagName.get()
    return 'error' if not val
    cval = canonical val
    return 'error' if model.collection(@type).findOne(_id: @id).tags[cval]?
    return 'success'
  tagAddStatus: ->
    val = Template.instance().newTagName.get()
    return 'Cannot be empty' if not val
    cval = canonical val
    return 'Tag already exists' if model.collection(@type).findOne(_id: @id).tags[cval]?
