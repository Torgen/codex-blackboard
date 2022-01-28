'use strict'

import { newMessage } from '/server/imports/newMessage.coffee'

linkify = do ->
  # linkify hashtags, URLs, and usernames.  Do this all in one pass so
  # that we don't try to linkify the contents of a previously-converted
  # link  (ie, when given `http://user@host/foo#bar` ).
  hashtagRE = /\#(?:\w+)/
  usernameRE = /@(?:[a-z0-9_]{1,15})(?![.a-z0-9_])/i
  # Note that we are using Gruber's "Liberal, Accurate Regex Pattern",
  # as amended by @cscott in https://gist.github.com/gruber/249502
  urlRE = /(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/i
  # a little bit of magic to glue these regexps into a single pattern
  pats = [urlRE,hashtagRE,usernameRE].map (re) -> re.source
  # start with ^|\s because there's no \b before @user and #hash
  # but also use \b to allow (http://...)
  re = new RegExp('(^|\\b|\\s)(?:(' + pats.join(')|(') + '))', 'ig')
  # ok!
  return (input) ->
    input.replace re, (text,sp,url,hashtag,username) -> switch
      when url? then "#{sp}<a href='#{url}' target='_blank'>#{url}</a>"
      when hashtag? then "#{sp}<a href='https://twitter.com/search?q=#{encodeURIComponent hashtag}' target='_blank'>#{hashtag}</a>"
      when username? then "#{sp}<a href='https://twitter.com/#{encodeURIComponent username.slice(1)}' target='_blank'>#{username}</a>"
      else text # shouldn't really ever reach here

htmlify = (data) ->
  text = data.extended_tweet?.full_text ? data.full_text ? data.text
  linkify text

export default tweetToMessage = (data) ->
  return if data.retweeted_status? # don't report retweets
  unless data.user? # weird bug we saw
    console.log 'WEIRD TWIT!', data
    return
  console.log "Twitter! @#{data.user.screen_name} #{data.text}"
  body = htmlify data
  tweet = {
    id_str: data.id_str
    avatar: data.user.profile_image_url_https
  }
  if data.quoted_status?
    tweet.quote = htmlify data.quoted_status
    tweet.quote_id_str = data.quoted_status_id_str
    tweet.quote_nick = data.quoted_status.user.screen_name

  newMessage {
    nick: data.user.screen_name
    room_name: 'general/0'
    body
    bodyIsHtml: true
    bot_ignore: true
    tweet
  }