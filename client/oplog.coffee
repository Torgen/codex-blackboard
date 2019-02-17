'use strict'
model = share.model
chat = share.chat

Template.oplog.helpers
  oplogs: ->
    model.Messages.find room_name: 'oplog/0',
      sort: [['timestamp','asc']]
  prettyType: ->
    model.pretty_collection(this.type)

Template.oplog.onRendered ->
  $("title").text("Operation Log Archive")
  $("body").scrollTo 'max'

Template.oplog.onCreated -> this.autorun =>
  room_name = 'oplog/0'
  this.subscribe 'recent-messages', room_name, +Session.get('limit')
