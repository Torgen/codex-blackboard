'use strict'

import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { DDP } from 'meteor/ddp-client';
import denodeify from 'denodeify'

# Utility -- returns a promise which resolves when all subscriptions are done
export waitForSubscriptions = -> new Promise (resolve) ->
  poll = Meteor.setInterval -> 
    if DDP._allSubscriptionsReady()
      Meteor.clearInterval(poll)
      resolve()
  , 200

# Tracker.afterFlush runs code when all consequent of a tracker based change
#   (such as a route change) have occured. This makes it a promise.
export afterFlushPromise = denodeify(Tracker.afterFlush)

export login = denodeify(Meteor.loginWithCodex)

export logout = denodeify(Meteor.logout)
