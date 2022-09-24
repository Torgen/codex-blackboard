'use strict'

import { computeMessageFollowup } from './followup.coffee'
import chai from 'chai'

TORGEN_MSG = $('<div class="bb-message media" data-nick="torgen">Yo</div>')[0]
CJB_MSG = $('<div class="bb-message media" data-nick="cjb">Whazzup?</div>')[0]
CJB_ACTION = $('<div class="bb-message-action" data-nick="cjb">Whazzup?</div>')[0]
TORGEN_PMTO_CJB = $('<div class="bb-message media bb-message-pm" data-nick="torgen" data-pm-to="cjb">Yo</div>')[0]
TORGEN_PMTO_BOT = $('<div class="bb-message media bb-message-pm" data-nick="torgen" data-pm-to="codexbot">help</div>')[0]
CJB_PM_TO_BOT = $('<div class="bb-message media bb-message-pm" data-nick="cjb" data-pm-to="codexbot">help</div>')[0]
TWEET = $('<div class="bb-message media bb-message-tweet" data-nick="torgen">Never tweet</div>')[0]

describe 'computeMessageFollowup', ->
  it 'no follow up for first thing', ->
    chai.assert.isFalse computeMessageFollowup null, TORGEN_MSG

  it 'follows up for regular messages from same person', ->
    chai.assert.isTrue computeMessageFollowup TORGEN_MSG, TORGEN_MSG

  it 'does not follow up for regular messages from different people', ->
    chai.assert.isFalse computeMessageFollowup TORGEN_MSG, CJB_MSG

  it 'does not follow up for tweets', ->
    chai.assert.isFalse computeMessageFollowup TWEET, TWEET
    chai.assert.isFalse computeMessageFollowup TORGEN_MSG, TWEET
    chai.assert.isFalse computeMessageFollowup TWEET, TORGEN_MSG

  it 'does not follow up for regular messages and action', ->
    chai.assert.isFalse computeMessageFollowup CJB_ACTION, CJB_MSG
    chai.assert.isFalse computeMessageFollowup CJB_MSG, CJB_ACTION

  it 'does not follow up for regular and private messages', ->
    chai.assert.isFalse computeMessageFollowup CJB_PM_TO_BOT, CJB_MSG
    chai.assert.isFalse computeMessageFollowup CJB_MSG, CJB_PM_TO_BOT

  it 'follows up for private messages from same person to same person', ->
    chai.assert.isTrue computeMessageFollowup TORGEN_PMTO_BOT, TORGEN_PMTO_BOT

  it 'does not follow up for private messages from same person to different people', ->
    chai.assert.isFalse computeMessageFollowup TORGEN_PMTO_BOT, TORGEN_PMTO_CJB

  it 'does not follow up for private messages from different people to same person ', ->
    chai.assert.isFalse computeMessageFollowup TORGEN_PMTO_BOT, CJB_PM_TO_BOT
