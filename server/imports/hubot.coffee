'use strict'

import canonical from '../../lib/imports/canonical.coffee'
import { callAs } from './impersonate.coffee'
import Hubot from 'hubot/es2015'

# Log messages?
DEBUG = !Meteor.isProduction

# Monkey-patch Hubot to support private messages
Hubot.Response::priv = (strings...) ->
  @robot.adapter.priv @envelope, strings...

tweakStrings = (strings, f) -> strings.map (obj) ->
  if typeof(obj) == 'string' then f(obj) else obj

class BlackboardAdapter extends Hubot.Adapter
  constructor: (robot, @botname, @gravatar) ->
    super robot
    
    # what's (the regexp for) my name?
    robot.respond /(?:)/, -> false
    @mynameRE = robot.listeners.pop().regex
  
  # Public: Raw method for sending data back to the chat source. Extend this.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more Strings for each message to send.
  #
  # Returns nothing.
  send: (envelope, strings...) ->
    console.log 'envelope', envelope
    return @priv envelope, strings... if envelope.message.private
    @sendHelper envelope, strings, (string, props) =>
      console.log "send #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      if envelope.message.direct and (not props.useful)
        unless string.startsWith(envelope.user.id)
          string = "#{envelope.user.id}: #{string}"
      callAs "newMessage", @botname, Object.assign {}, props,
        body: string
        room_name: envelope.room
        bot_ignore: true

  # Public: Raw method for sending emote data back to the chat source.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more Strings for each message to send.
  #
  # Returns nothing.
  emote: (envelope, strings...) ->
    if envelope.message.private
        return @priv envelope, tweakStrings(strings, (s) -> "*** #{s} ***")...
    @sendHelper envelope, strings, (string, props) =>
      console.log "emote #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      callAs "newMessage", @botname, Object.assign {}, props,
        body: string
        room_name: envelope.room
        action: true
        bot_ignore: true

  # Priv: our extension -- send a PM to user
  priv: (envelope, strings...) ->
    @sendHelper envelope, strings, (string, props) =>
      console.log "priv #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      callAs "newMessage", @botname, Object.assign {}, props,
        to: "#{envelope.user.id}"
        body: string
        room_name: envelope.room
        bot_ignore: true

  # Public: Raw method for building a reply and sending it back to the chat
  # source. Extend this.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more Strings for each reply to send.
  #
  # Returns nothing.
  reply: (envelope, strings...) ->
    if envelope.message.private
      @priv envelope, strings...
    else
      @send envelope, tweakStrings(strings, (str) -> "#{envelope.user.id}: #{str}")...

  # Public: Raw method for setting a topic on the chat source. Extend this.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One more more Strings to set as the topic.
  #
  # Returns nothing.
  topic: (envelope, strings...) ->

  # Public: Raw method for playing a sound in the chat source. Extend this.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more strings for each play message to send.
  #
  # Returns nothing
  play: (envelope, strings...) ->

  # Public: Raw method for invoking the bot to run. Extend this.
  #
  # Returns nothing.
  run: ->
    # register our nick
    Meteor.users.upsert @botname,
      $set:
        nickname: @robot.name
        gravatar: @gravatar
        bot_wakeup: share.model.UTCNow()
      $unset: services: ''
    # register our presence in general chat
    keepalive = => callAs 'setPresence', @botname,
      room_name: 'general/0'
      present: true
      foreground: true
    keepalive()
    @keepalive = Meteor.setInterval keepalive, 30*1000 # every 30s refresh presence
    
    IGNORED_NICKS = new Set ['', @botname]
    # listen to the chat room, ignoring messages sent before we startup
    startup = true
    @handle = share.model.Messages.find(timestamp: $gt: share.model.UTCNow()).observeChanges
      added: (id, msg) =>
        return if startup
        return if msg.bot_ignore
        return if IGNORED_NICKS.has msg.nick
        return if msg.system or msg.action or msg.oplog or msg.bodyIsHtml or msg.poll
        console.log "Received from #{msg.nick} in #{msg.room_name}: #{msg.body}"\
          if DEBUG
        user = new Hubot.User(msg.nick, room: msg.room_name)
        tm = new Hubot.TextMessage(user, msg.body, id)
        tm.private = msg.to?
        # if private, ensure it's treated as a direct address
        tm.direct = @mynameRE.test(tm.text)
        if tm.private and not tm.direct
          tm.text = "#{@robot.name} #{tm.text}"
        @receive tm
    startup = false
    callAs "newMessage", @botname,
      body: 'wakes up'
      room_name: 'general/0'
      action: true
      bot_ignore: true

  # Public: Raw method for shutting the bot down.
  #
  # Returns nothing.
  close: ->
    @handle?.stop()
    Meteor.clearInterval @keepalive

  sendHelper: Meteor.bindEnvironment (envelope, strings, map) ->
    # be present in the room
    try
      callAs 'setPresence', @botname,
        room_name: envelope.room
        present: true
        foreground: true
    props = Object.create(null)
    lines = []
    while strings.length > 0
      if typeof(strings[0]) is 'function'
        strings[0] = strings[0]()
        continue
      string = strings.shift()
      if typeof(string) is 'object'
        Object.assign props, string
        continue
      if string?
        lines.push string
    if lines.length and envelope.message.direct and (not props.useful)
      share.model.Messages.update envelope.message.id, $set: useless_cmd: true
    lines.map (line) ->
      try
        map(line, props)
      catch err
        console.error "Hubot error: #{err}" if DEBUG
        @robot.logger.error "Blackboard send error: #{err}"

# grrrr, Meteor.bindEnvironment doesn't preserve `this` apparently
bind = (f) ->
  g = Meteor.bindEnvironment (self, args...) -> f.apply(self, args)
  (args...) -> g @, args...

Hubot.Robot::loadAdapter = -> 

export default class Robot extends Hubot.Robot
  constructor: (botname, @gravatar) ->
    super null, 'shell', false, botname, 'bot'
    @hear = bind @hear
    @respond = bind @respond
    @enter = bind @enter
    @leave = bind @leave
    @topic = bind @topic
    @error = bind @error
    @catchAll = bind @catchAll
    @adapter = new BlackboardAdapter @, canonical(@name), @gravatar

  hear:    (regex, callback) -> super regex, @privatize callback
  respond: (regex, callback) -> super regex, @privatize callback
  enter: (callback) -> super @privatize callback
  leave: (callback) -> super @privatize callback
  topic: (callback) -> super @privatize callback
  error: (callback) -> super  @privatize callback
  catchAll: (callback) -> super @privatize callback
  privately: (callback) ->
    # Call the given callback on this such that any listeners it registers will
    # behave as though they received a private message.
    @private = true
    try
      callback @
    finally
      @private = false
  privatize: (callback) ->
    Meteor.bindEnvironment if @private
      (resp) ->
        resp.message.private = true
        callback resp
    else callback

