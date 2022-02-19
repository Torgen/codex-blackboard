
import { ArrayMembers, NumberInRange, NonEmptyString, ObjectWith } from '/lib/imports/match.coffee'

Meteor.methods
  locateNick: (args) ->
    check @userId, NonEmptyString
    check args, ObjectWith
      location:
        type: 'Point'
        coordinates: ArrayMembers [NumberInRange(min: -180, max:180), NumberInRange(min: -90, max: 90)]
      timestamp: Match.Optional(Number)
    # the server transfers updates from priv_located* to located* at
    # a throttled rate to prevent N^2 blow up.
    # priv_located_order implements a FIFO queue for updates, but
    # you don't lose your place if you're already in the queue
    timestamp = share.model.UTCNow()
    n = Meteor.users.update @userId,
      $set:
        priv_located: args.timestamp ? timestamp
        priv_located_at: args.location
      $min: priv_located_order: timestamp
    throw new Meteor.Error(400, "bad userId: #{@userId}") unless n > 0