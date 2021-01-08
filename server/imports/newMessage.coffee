'use strict'
import canonical from '/lib/imports/canonical.coffee'
import { NonEmptyString } from '/lib/imports/match.coffee'
import emojify from './emoji.coffee'
import sanitize from 'sanitize-html'

params = {...sanitize.defaults}
params.allowedAttributes = {
  ...params.allowedAttributes, 
  '*': ['class'],
}

export ensureDawnOfTime = (room_name) ->
  share.model.Messages.upsert room_name,
    $min: timestamp: Date.now() - 1
    $setOnInsert:
      system: true
      dawn_of_time: true
      room_name: room_name
      bot_ignore: true
Meteor.startup ->
  ['general/0', 'callins/0', 'oplog/0'].forEach ensureDawnOfTime

export newMessage = (newMsg) ->
  check newMsg,
    body: String
    nick: NonEmptyString
    bodyIsHtml: Match.Optional Boolean
    action: Match.Optional Boolean
    to: Match.Optional NonEmptyString
    poll: Match.Optional NonEmptyString
    room_name: NonEmptyString
    useful: Match.Optional Boolean
    bot_ignore: Match.Optional Boolean
    # True for messages generated in main chat room as part of events that also generate oplogs.
    # Since oplogs are always in the header, these are redundant there, but should be in the chat room itself.
    header_ignore: Match.Optional Boolean
    # Present only in messages received via IMAP.
    # Nick will be sender's address.
    mail: Match.Optional
      sender_name: Match.Optional String
      subject: String
    # Present only in messages received via Twitter.
    # Nick will be sender's handle
    tweet: Match.Optional
      # numeric tweet ID as a string (as it's a large integer)
      id_str: NonEmptyString
      # url of tweeter's profile picture
      avatar: NonEmptyString
      # Body of quoted tweet, if this was a quote-retweet
      quote: Match.Optional NonEmptyString
      # Numeric id of quoted tweet as a string, if this was a quote-retweet
      quote_id_str: Match.Optional NonEmptyString
      # Twitter handle of tweeter of quoted tweet, if this was a quote-retweet
      quote_nick: Match.Optional NonEmptyString
  # translate emojis!
  if newMsg.bodyIsHtml
    newMsg.body = sanitize newMsg.body, params
    if newMsg.tweet?.quote?
      newMsg.tweet.quote = sanitize newMsg.tweet.quote, params
  else
    newMsg.body = emojify newMsg.body
  newMsg.to = canonical newMsg.to if newMsg.to?
  newMsg.timestamp = Date.now()
  ensureDawnOfTime newMsg.room_name
  newMsg._id = share.model.Messages.insert newMsg
  return newMsg
