'use strict'

import { Names } from '/lib/imports/collections.coffee'

Template.link.onCreated ->
  @target = new ReactiveVar null
  @autorun =>
    @target.set Names.findOne(Template.currentData().id)

Template.link.helpers
  target: -> Template.instance().target.get()
  text: -> Template.instance().data.text ? Template.instance().target.get()?.name
