'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { PRESENCE_KEEPALIVE_MINUTES } from '/lib/imports/constants.coffee'
import { Messages, Presence, Puzzles } from '/lib/imports/collections.coffee'

# look up a real name, if there is one
maybe_real_name = (nick) ->
  n = Meteor.users.findOne canonical nick
  return n?.real_name or nick

common_presence_fields =
  system: true
  to: null
  bodyIsHtml: false

class PresenceManager
  constructor: ->
    # Presence
    # ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
    @interval = Meteor.setInterval ->
      removeBefore = Date.now() - (2*PRESENCE_KEEPALIVE_MINUTES*60*1000)
      Presence.update
        "clients.timestamp": $lt: removeBefore
      ,
        $pull: clients: {timestamp: $lt: removeBefore}
    , 60*1000

    # generate automatic "<nick> entered <room>" and <nick> left room" messages
    # as the presence set changes
    initiallySuppressPresence = true
    @noclients = Presence.find(clients: []).observe
      added: (presence) ->
        Presence.remove presence._id
    @joinpart = Presence.find({scope: 'chat'}, {fields: {clients: 0}}).observe
      added: (presence) ->
        return if initiallySuppressPresence
        return if presence.room_name is 'oplog/0'
        Messages.insert {
          nick: presence.nick
          presence: 'join'
          body: "#{maybe_real_name presence.nick} joined the room."
          room_name: presence.room_name
          timestamp: presence.joined_timestamp
          ...common_presence_fields
        }
      removed: (presence) ->
        return if initiallySuppressPresence
        return if presence.room_name is 'oplog/0'
        Messages.insert {
          nick: presence.nick
          presence: 'part'
          body: "#{maybe_real_name presence.nick} left the room."
          room_name: presence.room_name
          timestamp: Date.now()
          ...common_presence_fields
        }
      changed: (newDoc, oldDoc) ->
        return if newDoc.bot
        match = oldDoc.room_name.match(/puzzles\/(.*)/)
        return unless match?
        timeDiff = newDoc.timestamp - oldDoc.timestamp
        return unless timeDiff > 0
        Puzzles.update {_id: match[1], solved: null},
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
