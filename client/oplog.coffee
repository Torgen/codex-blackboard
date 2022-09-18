'use strict'
model = share.model

room_name = 'oplog/0'

Template.oplog.helpers
  oplogs: ->
    model.Messages.find {room_name},
      sort: [['timestamp','asc']]
  prettyType: ->
    model.pretty_collection(this.type)
  # The dawn of time message has ID equal to the room name because it's
  # efficient to find it that way on the client, where there are no indexes.
  startOfChannel: -> model.Messages.findOne(_id: room_name)?

Template.oplog.onRendered ->
  $("title").text("Operation Log Archive")
  document?.querySelector?('.bb-oplog > *:last-child')?.scrollIntoView()

Template.oplog.onCreated -> this.autorun =>
  this.subscribe 'recent-messages', room_name, +Session.get('limit')

Template.oplog.events
  'click .bb-oplog-load-more': (event, template) ->
    Session.set 'limit', Session.get('limit') + settings.CHAT_LIMIT_INCREMENT
