'use strict'

presenceIndex = new Map

ensure = (channel) ->
  coll = presenceIndex.get(channel)
  unless coll?
    coll = new Mongo.Collection null
    presenceIndex.set(channel, coll)
  return coll

model = share.model

Meteor.startup ->
  model.Presence.find(scope: $in: ['chat', 'jitsi']).observe
    added: (doc) ->
      ensure(doc.room_name).upsert doc.nick,
        $min: joined_timestamp: doc.joined_timestamp
        $max:
          jitsi: +(doc.scope is 'jitsi')
          chat: +(doc.scope is 'chat')
    removed: (doc) ->
      coll = presenceIndex.get doc.room_name
      return unless coll?
      coll.update doc.nick,
        $min:
          jitsi: +(doc.scope isnt 'jitsi')
          chat: +(doc.scope isnt 'chat')
      coll.remove {_id: doc.nick, jitsi: 0, chat: 0}

export findByChannel = (channel, query, options) ->
  return ensure(channel).find(query, options)
