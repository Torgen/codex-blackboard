'use strict'

model = share.model # import

Template.link.onCreated ->
  @autorun =>
    @target = model.Names.findOne(Template.currentData().id)

Template.link.helpers
  target: -> Template.instance().target
  text: -> Template.instance().data.text ? Template.instance().target?.name