'use strict'

import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { DDP } from 'meteor/ddp-client';
import chai from 'chai'
import denodeify from 'denodeify'

# Utility -- returns a promise which resolves when all subscriptions are done
waitForSubscriptions = -> new Promise (resolve) ->
  poll = Meteor.setInterval -> 
    if DDP._allSubscriptionsReady()
      Meteor.clearInterval(poll)
      resolve()
  , 200

# Tracker.afterFlush runs code when all consequent of a tracker based change
#   (such as a route change) have occured. This makes it a promise.
afterFlushPromise = denodeify(Tracker.afterFlush)

describe 'blackboard', ->
  @timeout 10000
  before ->
    denodeify(Meteor.loginWithCodex)('testy', 'Teresa Tybalt', '', '')
  
  after ->
    denodeify(Meteor.logout)()

  it 'renders in readonly mode', ->
    await waitForSubscriptions()
    # there should be a table header for the Civilization round.
    civId = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isNotNull $("##{civId._id}").html()

  it 'renders in edit mode', ->
    share.Router.EditPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    # there should be a table header for the Civilization round.
    civId = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isNotNull $("##{civId._id}").html()

