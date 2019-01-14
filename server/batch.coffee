'use strict'
return unless share.DO_BATCH_PROCESSING

import canonical from '../lib/imports/canonical.coffee'
import { canonicalTags, getTag } from '../lib/imports/tags.coffee'

model = share.model

# Does various fixups of the collections.
# Was in lib/model.coffee, but that meant it was loaded on the client even
# though it could never run there.

# how many chats in a page?
MESSAGE_PAGE = 100

# move pages of messages to oldmessages collection
MOVE_OLD_PAGES = true

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

if Meteor.settings.migrateTags
  ['rounds', 'puzzles'].forEach (c) ->
    model.collection(c).find().forEach (o) ->
      return unless o.tags instanceof Array
      console.log 'migrating', model.pretty_collection(c), o._id
      model.collection(c).update o._id, $set: tags: canonicalTags(o.tags, 'codexbot')

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

# Pages
# ensure old pages have the `archived` field
Meteor.startup ->
  model.Pages.find(archived: $exists: false).forEach (p) ->
    model.Pages.update p._id, $set: archived: false
# move messages to oldmessages collection
queueMessageArchive = throttle ->
  p = model.Pages.findOne({archived: false, next: $ne: null}, {sort:[['to','asc']]})
  return unless p?
  limit = 2 * MESSAGE_PAGE
  loop
    msgs = model.Messages.find({room_name: p.room_name, timestamp: $lt: p.to}, \
      {sort:[['timestamp','asc']], limit: limit, reactive: false}).fetch()
    model.OldMessages.upsert(m._id, m) for m in msgs
    model.Pages.update(p._id, $set: archived: true) if msgs.length < limit
    model.Messages.remove(m._id) for m in msgs
    break if msgs.length < limit
  queueMessageArchive()
, 60*1000 # no more than once a minute
# watch messages collection and create pages as necessary
do ->
  unpaged = Object.create(null)
  model.Messages.find({}, sort:[['timestamp','asc']]).observe
    added: (msg) ->
      room_name = msg.room_name
      # don't count pms (so we don't end up with a blank 'page')
      return if msg.to
      # add to (conservative) count of unpaged messages
      # (this message might already be in a page, but we'll catch that below)
      unpaged[room_name] = (unpaged[room_name] or 0) + 1
      return if unpaged[room_name] < MESSAGE_PAGE
      # recompute page parameters before adding a new page
      # (be safe in case we had out-of-order observations)
      # find highest existing page
      p = model.Pages.findOne({room_name: room_name}, {sort:[['to','desc']]})\
        or { _id: null, room_name: room_name, from: -1, to: 0 }
      # count the number of unpaged messages
      m = model.Messages.find(\
        {room_name: room_name, to: null, timestamp: $gte: p.to}, \
        {sort:[['timestamp','asc']], limit: MESSAGE_PAGE}).fetch()
      if m.length < MESSAGE_PAGE
        # false alarm: reset unpaged message count and continue
        unpaged[room_name] = m.length
        return
      # ok, let's make a new page.  this will include at least all the
      # messages in m, possibly more (if there are additional messages
      # added with timestamp == m[m.length-1].timestamp)
      pid = model.Pages.insert
        room_name: room_name
        from: p.to
        to: 1 + m[m.length-1].timestamp
        prev: p._id
        next: null
        archived: false
      if p._id?
        model.Pages.update p._id, $set: next: pid
      unpaged[room_name] = 0
      queueMessageArchive() if MOVE_OLD_PAGES
# migrate messages to old messages collection
(Meteor.startup queueMessageArchive) if MOVE_OLD_PAGES

# Presence
# ensure old entries are timed out after 2*PRESENCE_KEEPALIVE_MINUTES
# some leeway here to account for client/server time drift
Meteor.setInterval ->
  #console.log "Removing entries older than", (UTCNow() - 5*60*1000)
  removeBefore = model.UTCNow() - (2*model.PRESENCE_KEEPALIVE_MINUTES*60*1000)
  model.Presence.remove timestamp: $lt: removeBefore
, 60*1000
# generate automatic "<nick> entered <room>" and <nick> left room" messages
# as the presence set changes
initiallySuppressPresence = true
model.Presence.find(present: true).observe
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
      timestamp: model.UTCNow()
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
# turn on presence notifications once initial observation set has been
# processed. (observe doesn't return on server until initial observation
# is complete.)
initiallySuppressPresence = false
