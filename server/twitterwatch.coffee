'use strict'
# Watch twitter and announce new tweets to general/0 chat.
#_
# The account login details are given in settings.json, like so:
# {
#   "twitter": {
#     "consumer_key": "xxxxxxxxx",
#     "consumer_secret": "yyyyyyyyyyyy",
#     "access_token_key": "zzzzzzzzzzzzzzzzzzzzzz",
#     "access_token_secret": "wwwwwwwwwwwwwwwwwwwwww"
#   }
# }

import { TwitterApi, ETwitterStreamEvent } from 'twitter-api-v2'
import tweetToMessage from './imports/twitter.coffee'

return unless share.DO_BATCH_PROCESSING
settings = Meteor.settings?.twitter ? {}
settings.consumer_key ?= process.env.TWITTER_CONSUMER_KEY
settings.consumer_secret ?= process.env.TWITTER_CONSUMER_SECRET
settings.access_token_key ?= process.env.TWITTER_ACCESS_TOKEN_KEY
settings.access_token_secret ?= process.env.TWITTER_ACCESS_TOKEN_SECRET
HASHTAGS = settings.hashtags?.join() ? process.env.TWITTER_HASHTAGS ? 'mysteryhunt,mitmysteryhunt'
return unless settings.consumer_key and settings.consumer_secret
return unless settings.access_token_key and settings.access_token_secret
twit = new TwitterApi
  appKey: settings.consumer_key
  appSecret: settings.consumer_secret
  accessToken: settings.access_token_key
  accessSecret: settings.access_token_secret

# See https://dev.twitter.com/streaming/overview/request-parameters#track
stream = Promise.await twit.v1.filterStream {track: HASHTAGS}
stream.autoReconnect = true
stream.autoReconnectRetries = Infinity
console.log "Listening to #{HASHTAGS} on twitter"
stream.on ETwitterStreamEvent.Data, Meteor.bindEnvironment tweetToMessage

stream.on ETwitterStreamEvent.ConnectError, Meteor.bindEnvironment (error) ->
  console.warn 'Twitter error:', error
