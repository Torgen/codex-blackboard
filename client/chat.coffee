'use strict'

import { nickEmail } from './imports/nickEmail.coffee'
import botuser from './imports/botuser.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'

model = share.model # import
settings = share.settings # import

GENERAL_ROOM = settings.GENERAL_ROOM_NAME
GENERAL_ROOM_REGEX = new RegExp "^#{GENERAL_ROOM}$", 'i'

Session.setDefault
  room_name: 'general/0'
  type:      'general'
  id:        '0'
  chatReady: false
  limit:     settings.INITIAL_CHAT_LIMIT

# Chat helpers!

# compare to: computeMessageFollowup in lib/model.coffee
computeMessageFollowup = (prev, curr) ->
  return false unless prev?.classList?.contains("media")
  return false unless prev.dataset.nick == curr.dataset.nick
  for c in ['bb-message-pm','bb-message-action','bb-message-system','bb-oplog']
    return false unless prev.classList.contains(c) is curr.classList.contains(c)
  return false unless prev.dataset.pmTo == curr.dataset.pmTo
  return true

assignMessageFollowup = (curr, prev) ->
  return prev unless curr instanceof Element
  return curr unless curr.classList.contains('media')
  if prev is undefined
    prev = curr.previousElementSibling
  if prev?
    prev = prev.previousElementSibling unless prev instanceof Element
  if computeMessageFollowup(prev, curr)
    curr.classList.add("bb-message-followup")
  else
    curr.classList.remove("bb-message-followup")
  return curr

assignMessageFollowupList = (nodeList) ->
  prev = if nodeList.length > 0 then nodeList[0].previousElementSibling
  for n in nodeList when n instanceof Element
    prev = assignMessageFollowup n, prev
  return prev

# Globals
instachat = {}
instachat["UTCOffset"] = new Date().getTimezoneOffset() * 60000
instachat["alertWhenUnreadMessages"] = false
instachat["scrolledToBottom"]        = true
instachat["mutationObserver"] = new MutationObserver (recs, obs) ->
  for rec in recs
    console.log rec unless Meteor.isProduction
    # previous element's followup status can't be affected by changes after it;
    assignMessageFollowupList rec.addedNodes
    nextEl = rec.nextSibling
    if nextEl? and not (nextEl instanceof Element)
      nextEl = nextEl.nextElementSibling
    assignMessageFollowup nextEl
  return

# Favicon instance, used for notifications
# (first add host to path)
favicon = badge: (-> false), reset: (-> false)
Meteor.startup ->
  favicon = share.chat.favicon = new Favico
    animation: 'slide'
    fontFamily: 'Noto Sans'
    fontStyle: '700'

Template.chat.helpers
  ready: ->
    type = Session.get 'type'
    type is 'general' or \
      (model.collection(type)?.findOne Session.get("id"))?
  object: ->
    type = Session.get 'type'
    type isnt 'general' and \
      (model.collection(type)?.findOne Session.get("id"))
  solved: ->
    type = Session.get 'type'
    type isnt 'general' and \
      (model.collection(type)?.findOne Session.get("id"))?.solved

Template.starred_messages.onCreated ->
  this.autorun =>
    this.subscribe 'starred-messages', Session.get 'room_name'

Template.starred_messages.helpers
  messages: ->
    model.Messages.find {room_name: (Session.get 'room_name'), starred: true },
      sort: [['timestamp', 'asc']]
      transform: messageTransform

Template.media_message.events
  'click .bb-message.starred .bb-message-star': (event, template) ->
    return unless $(event.target).closest('.can-modify-star').size() > 0
    Meteor.call 'setStarred', this._id, false
  'click .bb-message:not(.starred) .bb-message-star': (event, template) ->
    return unless $(event.target).closest('.can-modify-star').size() > 0
    Meteor.call 'setStarred', this._id, true

Template.message_delete_button.events
  'click .bb-delete-message': (event, template) ->
    alertify.confirm 'Really delete this message?', (e) =>
      return unless e
      Meteor.call 'deleteMessage', @_id

Template.poll.onCreated ->
  @show_votes = new ReactiveVar false
  @autorun =>
    @subscribe 'poll', Template.currentData()

Template.poll.helpers
  show_votes: -> Template.instance().show_votes.get()
  email: -> nickEmail @_id
  options: ->
    poll = model.Polls.findOne @
    return unless poll?
    votes = {}
    myVote = poll.votes[Meteor.userId()]?.canon
    for p in poll.options
      votes[p.canon] = []
    for voter, vote of poll.votes
      votes[vote.canon].push {_id: voter, timestamp: vote.timestamp}
    max = 1
    for canon, voters of votes
      max = voters.length if voters.length > max
    (
      votes[p.canon].sort (a, b) -> a.timestamp - b.timestamp
      _id: p.canon
      text: p.option
      votes: votes[p.canon]
      width: 100 * votes[p.canon].length / max
      yours: myVote is p.canon
      leading: votes[p.canon].length >= max
    ) for p in poll.options

Template.poll.events
  'click button[data-option]': (event, template) ->
    Meteor.call 'vote', template.data, event.target.dataset.option
  'click button.toggle-votes': (event, template) ->
    template.show_votes.set(not template.show_votes.get())


messageTransform = (m) ->
  _id: m._id
  message: m
  email: nickEmail m.nick
  body: ->
    body = m.body or ''
    unless m.bodyIsHtml
      body = UI._escape body
      body = body.replace /\n|\r\n?/g, '<br/>'
      body = convertURLsToLinksAndImages body, m._id
      if doesMentionNick m
        body = highlightNick body, m.bodyIsHtml
    new Spacebars.SafeString(body)

# Template Binding
Template.messages.helpers
  room_name: -> Session.get('room_name')
  ready: -> Session.equals('chatReady', true) and \
            Template.instance().subscriptionsReady()
  isLastRead: (ts) -> Session.equals('lastread', +ts)
  # The dawn of time message has ID equal to the room name because it's
  # efficient to find it that way on the client, where there are no indexes.
  startOfChannel: -> model.Messages.findOne(_id: Session.get 'room_name')?
  usefulEnough: (m) ->
    # test Session.get('nobot') last to get a fine-grained dependency
    # on the `nobot` session variable only for 'useless' messages
    myNick = Meteor.userId()
    botnick = botuser()._id
    m.nick is myNick or m.to is myNick or \
        m.useful or \
        (m.nick isnt 'via twitter' and m.nick isnt botnick and \
            not m.useless_cmd) or \
        doesMentionNick(m) or \
        ('true' isnt reactiveLocalStorage.getItem 'nobot')
  messages: ->
    room_name = Session.get 'room_name'
    # I will go out on a limb and say we need this because transform uses
    # doesMentionNick and transforms aren't usually reactive, so we need to
    # recompute them if you log in as someone else.
    Meteor.userId()
    return model.Messages.find {room_name},
      sort: [['timestamp','asc']]
      transform: messageTransform
      
selfScroll = null

touchSelfScroll = ->
  Meteor.clearTimeout selfScroll if selfScroll?
  selfScroll = Meteor.setTimeout ->
    selfScroll = null
  , 1000 # ignore browser-generated scroll events for 1 (more) second

Template.messages.helpers
  scrollHack: (m) ->
    touchSelfScroll() # ignore scroll events caused by DOM update
    maybeScrollMessagesView()

Template.messages.onCreated ->
  instachat.scrolledToBottom = true
  @autorun =>
    # put this in a separate autorun so it's not invalidated needlessly when
    # the limit changes.
    room_name = Session.get 'room_name'
    return unless room_name
    @subscribe 'presence-for-room', room_name
  @autorun =>
    invalidator = =>
      instachat.ready = false
      Session.set 'chatReady', false
      hideMessageAlert()
    invalidator()
    room_name = Session.get 'room_name'
    return unless room_name
    # load messages for this page
    onReady = =>
      instachat.ready = true
      Session.set 'chatReady', true
      return unless @limitRaise?
      [[firstMessage, offset], @limitRaise] = [@limitRaise, undefined]
      Tracker.afterFlush =>
        # only scroll if the button is visible, since it means we were at the
        # top and are still there. If we were anywhere else, the window would
        # have stayed put.
        messages = @$('#messages')[0]
        chatStart = @$('.bb-chat-load-more, .bb-chat-start')[0]
        return unless chatStart.getBoundingClientRect().bottom > messages.offsetTop
        # We can't just scroll the last new thing into view because of the header.
        # we have to find the thing whose offset top is as much above the message
        # we want to keep in view as the offset top of the messages element.
        # We would have to loop to find firstMessage's index in messages.children,
        # so just iterate backwards. Shouldn't take too long to find ~100 pixels.
        currMessage = firstMessage
        while currMessage? and firstMessage.offsetTop - currMessage.offsetTop < offset
          currMessage = currMessage.previousElementSibling
        currMessage?.scrollIntoView()
    @subscribe 'recent-messages', room_name, Session.get('limit'),
      onReady: onReady
    Tracker.onInvalidate invalidator

Template.messages.onRendered ->
  chatBottom = document.getElementById('chat-bottom')
  if window.IntersectionObserver and chatBottom?
    instachat.bottomObserver = new window.IntersectionObserver (entries) ->
      return if selfScroll?
      instachat.scrolledToBottom = entries[0].isIntersecting
    instachat.bottomObserver.observe(chatBottom)
  if settings.FOLLOWUP_STYLE is "js"
    # observe future changes
    $("#messages").each ->
      console.log "Observing #{this}" unless Meteor.isProduction
      instachat.mutationObserver.observe(this, {childList: true})

Template.messages.events
  'click .bb-chat-load-more': (event, template) ->
    firstMessage = event.currentTarget.nextElementSibling
    offset = firstMessage.offsetTop
    # Skip starred messages because they might be loaded by a different publish.
    while firstMessage.classList.contains 'starred'
      firstMessage = firstMessage.nextElementSibling
    template.limitRaise = [firstMessage, offset]
    Session.set 'limit', Session.get('limit') + settings.CHAT_LIMIT_INCREMENT

whos_here_helper = ->
  roomName = Session.get('type') + '/' + Session.get('id')
  return model.Presence.find {room_name: roomName}, {sort:["nick"]}

Template.chat_header.helpers
  room_name: -> prettyRoomName()
  whos_here: whos_here_helper

# Utility functions

regex_escape = (s) -> s.replace /[$-\/?[-^{|}]/g, '\\$&'

GLOBAL_MENTIONS = /@(channel|everyone)/i

doesMentionNick = (doc, raw_nick=Meteor.userId()) ->
  return false unless raw_nick
  return false unless doc.body?
  return false if doc.system # system messages don't count as mentions
  return true if doc.nick is 'thehunt' # special alert for team email!
  nick = model.canonical raw_nick
  return false if nick is doc.nick # messages from yourself don't count
  return true if doc.to is nick # PMs to you count
  n = Meteor.users.findOne nick
  realname = n?.real_name
  return false if doc.bodyIsHtml # XXX we could fix this
  # case-insensitive match of canonical nick
  (new RegExp (regex_escape model.canonical nick), "i").test(doc.body) or \
    # case-sensitive match of non-canonicalized nick
    doc.body.indexOf(raw_nick) >= 0 or \
    # These things are treated as mentions for everyone
    GLOBAL_MENTIONS.test(doc.body) or \
    # match against full name
    (realname and (new RegExp (regex_escape realname), "i").test(doc.body))

highlightNick = (html, isHtml=false) ->
  if isHtml
    "<div class=\"highlight-nick\">" + html + "</div>"
  else
    "<span class=\"highlight-nick\">" + html + "</span>"

# Gruber's "Liberal, Accurate Regex Pattern",
# as amended by @cscott in https://gist.github.com/gruber/249502
urlRE = /\b(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/ig

convertURLsToLinksAndImages = (html, id) ->
  linkOrLinkedImage = (url, id) ->
    inner = url
    url = "http://#{url}" unless /^[a-z][\w\-]+:/.test(url)
    if url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i) and id?
      inner = "<img src='#{url}' class='inline-image image-loading' id='#{id}' onload='window.imageScrollHack(this)' />"
    "<a href='#{url}' target='_blank'>#{inner}</a>"
  count = 0
  html.replace urlRE, (url) ->
    linkOrLinkedImage url, "#{id}-#{count++}"

isVisible = share.isVisible = do ->
  hidden = "hidden"
  visibilityChange = "visibilitychange"
  if typeof document.hidden isnt "undefined"
    hidden = "hidden"
    visibilityChange = "visibilitychange"
  else if typeof document.mozHidden isnt "undefined"
    hidden = "mozHidden"
    visibilityChange = "mozvisibilitychange"
  else if typeof document.msHidden isnt "undefined"
    hidden = "msHidden"
    visibilityChange = "msvisibilitychange"
  else if typeof document.webkitHidden isnt "undefined"
    hidden = "webkitHidden"
    visibilityChange = "webkitvisibilitychange"

  _visible = new ReactiveVar()
  onVisibilityChange = -> _visible.set !(document[hidden] or false)
  document.addEventListener visibilityChange, onVisibilityChange, false
  onVisibilityChange()
  -> _visible.get()

prettyRoomName = ->
  type = Session.get('type')
  id = Session.get('id')
  name = if type is "general" then GENERAL_ROOM else \
    model.Names.findOne(id)?.name
  return (name or "unknown")

joinRoom = (type, id) ->
  share.Router.goToChat type, id
  Tracker.afterFlush -> scrollMessagesView()
  $("#messageInput").select()

maybeScrollMessagesView = do ->
  pending = false
  return ->
    return unless instachat.scrolledToBottom and not pending
    pending = true
    Tracker.afterFlush ->
      pending = false
      scrollMessagesView()

scrollMessagesView = ->
  touchSelfScroll()
  instachat.scrolledToBottom = true
  # first try using html5, then fallback to jquery
  last = document?.querySelector?('#messages > *:last-child')
  if last?.scrollIntoView?
    last.scrollIntoView()
  else
    $("body").scrollTo 'max'
  # the scroll handler below will reset scrolledToBottom to be false
  instachat.scrolledToBottom = true

# Event Handlers
Template.header_loginmute.events
  'click button.mute': (event, template) ->
    reactiveLocalStorage.setItem 'mute', 'true' isnt reactiveLocalStorage.getItem 'mute'
  'click button.nobot': (event, template) ->
    reactiveLocalStorage.setItem 'nobot', 'true' isnt reactiveLocalStorage.getItem 'nobot'
    touchSelfScroll() # ignore scroll event generated by CSS relayout
    maybeScrollMessagesView()

# ensure that we stay stuck to bottom even after images load
imageScrollHack = window.imageScrollHack = (img) ->
  touchSelfScroll() # ignore scroll event generated by image resize
  if img?.classList?
    img.classList.remove 'image-loading'
  maybeScrollMessagesView()
# note that image load does not delegate, so we can't use it here in
# a document-wide "live" event handler

Template.media_message.events
  'mouseenter .bb-message-body .inline-image': (event, template) -> imageScrollHack(event.currentTarget)

# unstick from bottom if the user manually scrolls
$(window).scroll (event) ->
  return unless Session.equals('currentPage', 'chat')
  return if instachat.bottomObserver
  #console.log if selfScroll? then 'Self scroll' else 'External scroll'
  return if selfScroll?
  # set to false, just in case older browser doesn't have scroll properties
  instachat.scrolledToBottom = false
  [body, html] = [document.body, document.documentElement]
  return unless html?.scrollTop? and html?.scrollHeight?
  return unless html?.clientHeight?
  SLOP=80
  [scrollPos, scrollMax] = [body.scrollTop+html.clientHeight, body.scrollHeight]
  atBottom = (scrollPos+SLOP >= scrollMax)
  # firefox says that the HTML element is scrolling, not the body element...
  if html.scrollTopMax?
    atBottom = (html.scrollTop+SLOP >= (html.scrollTopMax-1)) or atBottom
  unless Meteor.isProduction
    console.log 'Scroll debug:', 'atBottom', atBottom, 'scrollPos', scrollPos, 'scrollMax', scrollMax
    console.log ' body scrollTop', body.scrollTop, 'scrollTopMax', body.scrollTopMax, 'scrollHeight', body.scrollHeight, 'clientHeight', body.clientHeight
    console.log ' html scrollTop', html.scrollTop, 'scrollTopMax', html.scrollTopMax, 'scrollHeight', html.scrollHeight, 'clientHeight', html.clientHeight
  instachat.scrolledToBottom = atBottom

Template.messages_input.submit = (message) ->
  return unless message
  args =
    room_name: Session.get 'room_name'
    body: message
  [word1, rest] = message.split(/\s+([^]*)/, 2)
  switch word1
    when "/me"
      args.body = rest
      args.action = true
    when "/users", "/show", "/list"
      args.to = args.nick
      args.action = true
      whos_here = \
        model.Presence.find({room_name: args.room_name}, {sort:["nick"]}) \
        .fetch().map (obj) ->
          if obj.foreground then obj.nick else "(#{obj.nick})"
      if whos_here.length == 0
        whos_here = "nobody"
      else if whos_here.length == 1
        whos_here = whos_here[0]
      else if whos_here.length == 2
        whos_here = whos_here.join(' and ')
      else
        whos_here[whos_here.length-1] = 'and ' + whos_here[whos_here.length-1]
        whos_here = whos_here.join(', ')
      args.body = "looks around and sees: #{whos_here}"
    when "/nick"
      args.to = @userId
      args.action = true
      args.body = "needs to log out and log in again to change nicks"
    when "/join"
      args.to = @userId
      args.action = true
      return Meteor.call 'getByName', {name: rest.trim()}, (error,result) ->
        if (not result?) and GENERAL_ROOM_REGEX.test(rest.trim())
          result = {type:'general',object:_id:'0'}
        if error? or not result?
          args.body = "tried to join an unknown chat room"
          return Meteor.call 'newMessage', args
        hideMessageAlert()
        joinRoom result.type, result.object._id
    when "/msg", "/m"
      # find who it's to
      [to, rest] = rest.split(/\s+([^]*)/, 2)
      missingMessage = (not rest)
      while rest
        n = Meteor.users.findOne model.canonical to
        break if n
        if to is 'bot' # allow 'bot' as a shorthand for 'codexbot'
          to = botuser()._id
          continue
        [extra, rest] = rest.split(/\s+([^]*)/, 2)
        to += ' ' + extra
      if n
        args.body = rest
        args.to = to
      else
        # error: unknown user
        # record this attempt as a PM to yourself
        args.to = @userId
        args.body = "tried to /msg an UNKNOWN USER: #{message}"
        args.body = "tried to say nothing: #{message}" if missingMessage
        args.action = true
  Meteor.call 'newMessage', args # updates LastRead as a side-effect
  # for flicker prevention, we are currently not doing latency-compensation
  # on the newMessage call, which makes the below ineffective.  But leave
  # it here in case we turn latency compensation back on.
  Tracker.afterFlush -> scrollMessagesView()
  return

Template.messages_input.events
  "keydown textarea": (event, template) ->
    # tab completion
    if event.which is 9 # tab
      event.preventDefault() # prevent tabbing away from input field
      $message = $ event.currentTarget
      message = $message.val()
      if message
        re = new RegExp "^#{regex_escape message}", "i"
        for present in whos_here_helper().fetch()
          n = Meteor.users.findOne present.nick
          realname = n?.real_name
          if re.test present.nick
            return $message.val "#{present.nick}: "
          else if realname and re.test realname
            return $message.val "#{realname}: "
          else if re.test "@#{present.nick}"
            return $message.val "@#{present.nick} "
          else if realname and re.test "@#{realname}"
            return $message.val "@#{realname} "
          else if re.test("/m #{present.nick}") or \
                  re.test("/msg #{present.nick}") or \
                  realname and (re.test("/m #{realname}") or \
                                re.test("/msg #{realname}"))
            return $message.val "/msg #{present.nick} "
        if re.test('bot')
          return $message.val "#{botuser()._id} "
        if re.test('/m bot') or re.test('/msg bot')
          return $message.val "/msg #{botuser()._id} "

    # implicit submit on enter (but not shift-enter or ctrl-enter)
    return unless event.which is 13 and not (event.shiftKey or event.ctrlKey)
    event.preventDefault() # prevent insertion of enter
    $message = $ event.currentTarget
    message = $message.val()
    $message.val ""
    Template.messages_input.submit message
  'blur #messageInput': (event, template) ->
    # alert for unread messages
    instachat.alertWhenUnreadMessages = true
  'focus #messageInput': (event, template) -> 
    updateLastRead() if instachat.ready # skip during initial load
    instachat.alertWhenUnreadMessages = false
    hideMessageAlert()

updateLastRead = ->
  lastMessage = model.Messages.findOne
    room_name: Session.get 'room_name'
  ,
    sort: [['timestamp','desc']]
  return unless lastMessage
  Meteor.call 'updateLastRead',
    room_name: Session.get 'room_name'
    timestamp: lastMessage.timestamp

hideMessageAlert = -> updateNotice 0, 0

Template.chat.onCreated ->
  this.autorun =>
    $("title").text("Chat: "+prettyRoomName())
  this.autorun =>
    instachat.keepalive?()
    updateLastRead() if isVisible() and instachat.ready

Template.chat.onRendered ->
  $(window).resize()
  type = Session.get('type')
  id = Session.get('id')
  joinRoom type, id

startupChat = ->
  return if instachat.keepaliveInterval?
  instachat.keepalive = ->
    Meteor.call "setPresence",
      room_name: Session.get "room_name"
      present: true
      foreground: isVisible() # foreground/background tab status
      uuid: settings.CLIENT_UUID # identify this tab
  instachat.keepalive()
  # send a keep alive every N minutes
  instachat.keepaliveInterval = \
    Meteor.setInterval instachat.keepalive, (model.PRESENCE_KEEPALIVE_MINUTES*60*1000)

cleanupChat = ->
  try
    favicon.reset()
  instachat.mutationObserver?.disconnect()
  instachat.bottomObserver?.disconnect()
  if instachat.keepaliveInterval?
    Meteor.clearInterval instachat.keepaliveInterval
    instachat.keepalive = instachat.keepaliveInterval = undefined
  if false # causes bouncing. just let it time out.
    Meteor.call "setPresence",
      room_name: Session.get "room_name"
      present: false

Template.messages.onCreated startupChat

Template.messages.onDestroyed ->
  cleanupChat()
  hideMessageAlert()

# window.unload is a bit spotty with async stuff, but we might as well try
$(window).unload -> cleanupChat()

# App startup
Meteor.startup ->
  return unless typeof Audio is 'function' # for phantomjs
  instachat.messageMentionSound = new Audio "/sound/Electro_-S_Bainbr-7955.wav"

updateNotice = do ->
  [lastUnread, lastMention] = [0, 0]
  (unread, mention) ->
    if mention > lastMention and instachat.ready
      instachat.messageMentionSound?.play?() unless 'true' is reactiveLocalStorage.getItem 'mute'
    # update title and favicon
    if mention > 0
      favicon.badge mention, {bgColor: '#00f'} if mention != lastMention
    else
      favicon.badge unread, {bgColor: '#000'} if unread != lastUnread
    ## XXX check instachat.ready and instachat.alertWhenUnreadMessages ?
    [lastUnread, lastMention] = [unread, mention]

Template.messages.onCreated -> @autorun ->
  nick = Meteor.userId() or ''
  room_name = Session.get 'room_name'
  unless nick and room_name
    Session.set 'lastread', undefined
    return hideMessageAlert()
  Tracker.onInvalidate hideMessageAlert
  # watch the last read and update the session
  Meteor.subscribe 'lastread', room_name
  lastread = model.LastRead.findOne {nick, room_name}
  unless lastread
    Session.set 'lastread', undefined
    return hideMessageAlert()
  Session.set 'lastread', lastread.timestamp
  # watch the unread messages
  total_unread = 0
  total_mentions = 0
  update = -> false # ignore initial updates
  model.Messages.find
    room_name: room_name
    nick: $ne: nick
    timestamp: $gt: lastread.timestamp
  .observe
    added: (item) ->
      return if item.system
      total_unread++
      total_mentions++ if doesMentionNick item
      update()
    removed: (item) ->
      return if item.system
      total_unread--
      total_mentions-- if doesMentionNick item
      update()
    changed: (newItem, oldItem) ->
      unless oldItem.system
        total_unread--
        total_mentions-- if doesMentionNick oldItem
      unless newItem.system
        total_unread++
        total_mentions++ if doesMentionNick newItem
      update()
  # after initial query is processed, handle updates
  update = -> updateNotice total_unread, total_mentions
  update()

# evil hack to workaround scroll issues.
do ->
  f = ->
    return unless Session.equals('currentPage', 'chat')
    maybeScrollMessagesView()
  Meteor.setTimeout f, 5000

# exports
share.chat =
  favicon: favicon
  convertURLsToLinksAndImages: convertURLsToLinksAndImages
  hideMessageAlert: hideMessageAlert
  joinRoom: joinRoom
  # for debugging
  instachat: instachat
