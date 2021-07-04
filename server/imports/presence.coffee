'use strict'

import canonical from '/lib/imports/canonical.coffee'

model = share.model

class PresenceManager
  constructor: ->
    # Presence
    # ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
    @interval = Meteor.setInterval ->
      #console.log "Removing entries older than", (UTCNow() - 5*60*1000)
      removeBefore = model.UTCNow() - (2*model.PRESENCE_KEEPALIVE_MINUTES*60*1000)
      model.Presence.update
        "clients.timestamp": $lt: removeBefore
      ,
        $pull: clients: {timestamp: $lt: removeBefore}
    , 60*1000

    # generate automatic "<nick> entered <room>" and <nick> left room" messages
    # as the presence set changes
    initiallySuppressPresence = true
    @noclients = model.Presence.find(clients: []).observe
      added: (presence) ->
        model.Presence.remove presence._id
    @joinpart = model.Presence.find({scope: 'chat'}, {fields: {clients: 0}}).observe
      added: (presence) ->
        return if initiallySuppressPresence
        return if presence.room_name is 'oplog/0'
        # look up a real name, if there is one
        n = Meteor.users.findOne canonical presence.nick
        name = n?.real_name or presence.nick
        model.Messages.insert
          system: true
          nick: presence.nick
          to: null
          presence: 'join'
          body: "#{name} joined the room."
          bodyIsHtml: false
          room_name: presence.room_name
          timestamp: presence.joined_timestamp
      removed: (presence) ->
        return if initiallySuppressPresence
        return if presence.room_name is 'oplog/0'
        # look up a real name, if there is one
        n = Meteor.users.findOne canonical presence.nick
        name = n?.real_name or presence.nick
        model.Messages.insert
          system: true
          nick: presence.nick
          to: null
          presence: 'part'
          body: "#{name} left the room."
          bodyIsHtml: false
          room_name: presence.room_name
          timestamp: model.UTCNow()
      changed: (newDoc, oldDoc) ->
        return if newDoc.bot
        match = oldDoc.room_name.match(/puzzles\/(.*)/)
        return unless match?
        timeDiff = newDoc.timestamp - oldDoc.timestamp
        return unless timeDiff > 0
        model.Puzzles.update {_id: match[1], solved: null},
          $inc: solverTime: timeDiff
    # turn on presence notifications once initial observation set has been
    # processed. (observe doesn't return on server until initial observation
    # is complete.)
    initiallySuppressPresence = false

  stop: ->
    @noclients.stop()
    @joinpart.stop()
    Meteor.clearInterval @interval

export default watchPresence = -> return new PresenceManager
