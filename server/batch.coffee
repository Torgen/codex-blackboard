'use strict'
return unless share.DO_BATCH_PROCESSING

import canonical from '../lib/imports/canonical.coffee'
import { canonicalTags, getTag } from '../lib/imports/tags.coffee'
import watchPresence from './imports/presence.coffee'

model = share.model

# Does various fixups of the collections.
# Was in lib/model.coffee, but that meant it was loaded on the client even
# though it could never run there.

model.CallIns.update
  status: null
,
  $set: status: 'pending'
,
  multi: true
try
  Promise.await model.CallIns.rawCollection().dropIndex('target_1_answer_1')
# No problem if it doesn't exist.

# helper function: like _.throttle, but always ensures `wait` of idle time
# between invocations.  This ensures that we stay chill even if a single
# execution of the function starts to exceed `wait`.
throttle = (func, wait = 0) ->
  [context, args, running, pending] = [null, null, false, false]
  later = ->
    if pending
      run()
    else
      running = false
  run = ->
    [running, pending] = [true, false]
    try
      func.apply(context, args)
    # Note that the timeout doesn't start until the function has completed.
    Meteor.setTimeout(later, wait)
  (a...) ->
    return if pending
    [context, args] = [this, a]
    if running
      pending = true
    else
      running = true
      Meteor.setTimeout(run, 0)

# Nicks: synchronize priv_located* with located* at a throttled rate.
# order by priv_located_order, which we'll clear when we apply the update
# this ensures nobody gets starved for updates
do ->
  # limit to 10 location updates/minute
  LOCATION_BATCH_SIZE = 10
  LOCATION_THROTTLE = 60*1000
  runBatch = ->
    Meteor.users.find({
      priv_located_order: { $exists: true, $ne: null }
    }, {
      sort: [['priv_located_order','asc']]
      limit: LOCATION_BATCH_SIZE
    }).forEach (n, i) ->
      console.log "Updating location for #{n._id} (#{i})"
      Meteor.users.update n._id,
        $set:
          located: n.priv_located
          located_at: n.priv_located_at
        $unset: priv_located_order: ''
  maybeRunBatch = throttle(runBatch, LOCATION_THROTTLE)
  Meteor.users.find({
    priv_located_order: { $exists: true, $ne: null }
  }, {
    fields: priv_located_order: 1
  }).observeChanges
    added: (id, fields) -> maybeRunBatch()
    # also run batch on removed: batch size might not have been big enough
    removed: (id) -> maybeRunBatch()

presence = watchPresence()
