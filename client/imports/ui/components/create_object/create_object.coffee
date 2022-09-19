import './create_object.html'
import canonical from '/lib/imports/canonical.coffee'
import { collection, pretty_collection } from '/lib/imports/collections.coffee'
import okCancelEvents from '/client/imports/ok_cancel_events.coffee'

Template.create_object.onCreated ->
  @name = new ReactiveVar ''

Template.create_object.onRendered ->
  @$('input').focus()

Template.create_object.events
  'focus/input input': (event, template) ->
    template.name.set event.currentTarget.value

Template.create_object.events okCancelEvents 'input',
  cancel: (evt, template) -> @done.done()
  ok: (name, evt, template) ->
    return unless @done.done()
    type = pretty_collection(template.data.type)
    type = type[0].toUpperCase() + type.slice(1)
    Meteor.call "new#{type}", {name, ...@params}
    template.name.set ''

Template.create_object.helpers
  pretty: -> pretty_collection(@type)
  upperPretty: ->
    type = pretty_collection(@type)
    return type[0].toUpperCase() + type.slice(1)
  titleAddClass: ->
    val = Template.instance().name.get()
    return 'error' if not val
    cval = canonical val
    return 'error' if collection(@type).findOne(canon: cval)?
    return 'success'
  titleAddStatus: ->
    val = Template.instance().name.get()
    return 'Cannot be empty' if not val
    cval = canonical val
    return "Conflicts with another #{pretty_collection(@type)}" if collection(@type).findOne(canon: cval)?
