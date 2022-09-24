// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Watch twitter and announce new tweets to general/0 chat.
//_
// The account login details are given in settings.json, like so:
// {
//   "twitter": {
//     "consumer_key": "xxxxxxxxx",
//     "consumer_secret": "yyyyyyyyyyyy",
//     "access_token_key": "zzzzzzzzzzzzzzzzzzzzzz",
//     "access_token_secret": "wwwwwwwwwwwwwwwwwwwwww"
//   }
// }

import { TwitterApi, ETwitterStreamEvent } from 'twitter-api-v2';
import tweetToMessage from './imports/twitter.coffee';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee';

if (!DO_BATCH_PROCESSING) { return; }
const settings = Meteor.settings?.twitter ?? {};
if (settings.consumer_key == null) { settings.consumer_key = process.env.TWITTER_CONSUMER_KEY; }
if (settings.consumer_secret == null) { settings.consumer_secret = process.env.TWITTER_CONSUMER_SECRET; }
if (settings.access_token_key == null) { settings.access_token_key = process.env.TWITTER_ACCESS_TOKEN_KEY; }
if (settings.access_token_secret == null) { settings.access_token_secret = process.env.TWITTER_ACCESS_TOKEN_SECRET; }
const HASHTAGS = settings.hashtags?.join() ?? process.env.TWITTER_HASHTAGS ?? 'mysteryhunt,mitmysteryhunt';
if (!settings.consumer_key || !settings.consumer_secret) { return; }
if (!settings.access_token_key || !settings.access_token_secret) { return; }
const twit = new TwitterApi({
  appKey: settings.consumer_key,
  appSecret: settings.consumer_secret,
  accessToken: settings.access_token_key,
  accessSecret: settings.access_token_secret
});

// See https://dev.twitter.com/streaming/overview/request-parameters#track
const stream = Promise.await(twit.v1.filterStream({track: HASHTAGS}));
stream.autoReconnect = true;
stream.autoReconnectRetries = Infinity;
console.log(`Listening to ${HASHTAGS} on twitter`);
stream.on(ETwitterStreamEvent.Data, Meteor.bindEnvironment(tweetToMessage));

stream.on(ETwitterStreamEvent.ConnectError, Meteor.bindEnvironment(error => console.warn('Twitter error:', error))
);
