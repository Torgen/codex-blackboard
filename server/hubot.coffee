# Start a hubot, connected to our chat room.
'use strict'
model = share.model # import

Useful = share.Useful

# Log messages?
DEBUG = !Meteor.isProduction

BOTNAME = Meteor.settings?.botname or process.env.BOTNAME or 'codexbot'

# Monkey-patch Hubot to support private messages
Hubot.Response::priv = (strings...) ->
  @robot.adapter.priv @envelope, strings...
# More monkey-patching
Hubot.Robot::loadAdapter = -> # disable

class RespondResponse extends Hubot.Response
  constructor: (@delegate) ->
    super @delegate.robot, @delegate.message, @delegate.match
    console.log "RespondResponse for #{@message.id}" if DEBUG

  runWithMiddleware: (method, opts, strings...) ->
    useful = false
    mod = {}
    for str in strings
      if str instanceof Useful
        useful = str.useful
      else if typeof(str) == 'string'
        if useful
          mod.anyUsefulResponses = true
        else
          mod.anyUselessResponses = true
    model.Messages.update @message.id, $set: mod
    @delegate.runWithMiddleware method, opts, strings...

Hubot.Robot::oldRespond = Hubot.Robot::respond
Hubot.Robot::respond = (regex, options, callback) ->
  if not callback? and typeof(options) is 'function'
    [options, callback] = [{}, options]
  return @oldRespond regex, (resp) ->
    callback new RespondResponse resp

# grrrr, Meteor.bindEnvironment doesn't preserve `this` apparently
bind = (f) ->
  g = Meteor.bindEnvironment (self, args...) -> f.apply(self, args)
  (args...) -> g @, args...

class Robot extends Hubot.Robot
  constructor: (args...) ->
    super args...
    @hear = bind @hear
    @respond = bind @respond
    @enter = bind @enter
    @leave = bind @leave
    @topic = bind @topic
    @error = bind @error
    @catchAll = bind @catchAll
  loadAdapter: -> false
  hear:    (regex, callback) -> super regex, Meteor.bindEnvironment callback
  respond: (regex, callback) -> super regex, Meteor.bindEnvironment callback
  enter: (callback) -> super Meteor.bindEnvironment(callback)
  leave: (callback) -> super Meteor.bindEnvironment(callback)
  topic: (callback) -> super Meteor.bindEnvironment(callback)
  error: (callback) -> super Meteor.bindEnvironment(callback)
  catchAll: (callback) -> super Meteor.bindEnvironment(callback)

sendHelper = Meteor.bindEnvironment (robot, envelope, strings, map) ->
  # be present in the room
  try
    Meteor.call 'setPresence',
      nick: 'codexbot'
      room_name: envelope.room
      present: true
      foreground: true
  useful = false
  while strings.length > 0
    string = strings.shift()
    if string instanceof Useful
      useful = string.useful
    else if typeof(string) == 'function'
      string()
    else
      try
        map(string, useful)
      catch err
        console.error "Hubot error: #{err}" if DEBUG
        robot.logger.error "Blackboard send error: #{err}"

mentionize = (f) ->
  (str) ->
    if typeof(str) == 'function'
      return str
    else if str instanceof Useful
      return str
    else
      return f(str)

class BlackboardAdapter extends Hubot.Adapter
  # Public: Raw method for sending data back to the chat source. Extend this.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more Strings for each message to send.
  #
  # Returns nothing.
  send: (envelope, strings...) ->
    return @priv envelope, strings... if envelope.message.private
    sendHelper @robot, envelope, strings, (string, useful) ->
      console.log "send #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      Meteor.call "newMessage",
        nick: "codexbot"
        body: string
        room_name: envelope.room
        bot_ignore: true
        useless: not useful

  # Public: Raw method for sending emote data back to the chat source.
  #
  # envelope - A Object with message, room and user details.
  # strings  - One or more Strings for each message to send.
  #
  # Returns nothing.
  emote: (envelope, strings...) ->
    return @priv envelope, strings.map(mentionize (str) -> "*** #{str} ***")... if envelope.message.private
    sendHelper @robot, envelope, strings, (string, useful) ->
      console.log "emote #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      Meteor.call "newMessage",
        nick: "codexbot"
        body: string
        room_name: envelope.room
        action: true
        bot_ignore: true
        useless: not useful

  # Priv: our extension -- send a PM to user
  priv: (envelope, strings...) ->
    sendHelper @robot, envelope, strings, (string, useful) ->
      console.log "priv #{envelope.room}: #{string} (#{envelope.user.id})" if DEBUG
      Meteor.call "newMessage",
        nick: "codexbot"
        to: "#{envelope.user.id}"
        body: string
        room_name: envelope.room
        bot_ignore: true
        useless: not useful

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
      @send envelope, strings.map(mentionize (str) -> "#{envelope.user.id}: #{str}")...

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

  # Public: Raw method for shutting the bot down. Extend this.
  #
  # Returns nothing.
  close: ->

return unless model.DO_BATCH_PROCESSING
IGNORED_NICKS =
  'codexbot': true
  '': true
Meteor.startup ->
  robot = new Robot null, null, false, BOTNAME
  robot.alias = 'bot'
  adapter = robot.adapter = new BlackboardAdapter robot
  # what's (the regexp for) my name?
  robot.respond /(?:)/, -> false
  mynameRE = robot.listeners.pop().regex
  # register scripts
  HubotScripts(robot)
  Object.keys(share.hubot).forEach (scriptName) ->
    console.log "Loading hubot script: #{scriptName}"
    share.hubot[scriptName](robot)
  # register our nick
  n = Meteor.call 'newNick', {name: 'codexbot'}
  Meteor.call 'setTag', {type:'nicks', object:n._id, name:'Gravatar', value:'codex@printf.net', who:n.canon}
  # register our presence in general chat
  keepalive = -> Meteor.call 'setPresence',
    nick: 'codexbot'
    room_name: 'general/0'
    present: true
    foreground: true
  keepalive()
  Meteor.setInterval keepalive, 30*1000 # every 30s refresh presence
  # listen to the chat room, ignoring messages sent before we startup
  startup = true
  model.Messages.find({}).observeChanges
    added: (id, msg) ->
      return if startup
      return if msg.bot_ignore
      return if IGNORED_NICKS[msg.nick]?
      return if msg.system or msg.action or msg.oplog or msg.bodyIsHtml
      console.log "Received from #{msg.nick} in #{msg.room_name}: #{msg.body}"\
        if DEBUG
      user = new Hubot.User(msg.nick, room: msg.room_name)
      tm = new Hubot.TextMessage(user, msg.body, id)
      tm.private = msg.to?
      # if private, ensure it's treated as a direct address
      if tm.private and not mynameRE.test(tm.text)
        tm.text = "#{robot.name} #{tm.text}"
      adapter.receive tm
  startup = false
  Meteor.call "newMessage",
    nick: "codexbot"
    body: 'wakes up'
    room_name: 'general/0'
    action: true
    bot_ignore: true
    useless: true
