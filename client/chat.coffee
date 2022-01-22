'use strict'

# Cannot destructure for testing purposes.
import jitsiModule, {jitsiUrl, jitsiRoom} from './imports/jitsi.coffee'
import { gravatarUrl, hashFromNickObject } from './imports/nickEmail.coffee'
import botuser from './imports/botuser.coffee'
import canonical from '/lib/imports/canonical.coffee'
import { CAP_JITSI_HEIGHT, HIDE_OLD_PRESENCE, HIDE_USELESS_BOT_MESSAGES, MUTE_SOUND_EFFECTS } from './imports/settings.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import {chunk_text, chunk_html} from './imports/chunk_text.coffee'

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
  # Special message types that are never followups
  for c in ['bb-message-mail', 'bb-message-tweet']
    return false if prev.classList.contains c
    return false if curr.classList.contains c
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
    assignReadMarker n
  return prev

assignReadMarker = (element) ->
  return unless element.dataset.read is 'read'
  return unless element.nextElementSibling?.dataset?.read is 'unread'
  $(instachat.readMarker).insertAfter element

# Globals
instachat = {}
instachat["UTCOffset"] = new Date().getTimezoneOffset() * 60000
instachat["alertWhenUnreadMessages"] = false
instachat["scrolledToBottom"]        = true
instachat['readMarker'] = $ '<div class="bb-message-last-read">read</div>'
instachat["mutationObserver"] = new MutationObserver (recs, obs) ->
  for rec in recs
    unless Meteor.isProduction
      console.log rec if [rec.addedNodes..., rec.removedNodes...].some (x) -> x instanceof Element
    # previous element's followup status can't be affected by changes after it;
    assignMessageFollowupList rec.addedNodes
    nextEl = rec.nextSibling
    if nextEl? and not (nextEl instanceof Element)
      nextEl = nextEl.nextElementSibling
    assignMessageFollowup nextEl
  return
instachat["readObserver"] = new MutationObserver (recs, obs) ->
  for rec in recs
    assignReadMarker rec.target

# Favicon instance, used for notifications
# (first add host to path)
favicon = badge: (-> false), reset: (-> false)
Meteor.startup ->
  favicon = share.chat.favicon = new Favico
    animation: 'slide'
    fontFamily: 'Noto Sans'
    fontStyle: '700'

Template.chat.helpers
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
  read: ->
    # Since a message can go from unread to read, but never the other way,
    # use a nonreactive read at first. If it's unread, then do a reactive read
    # to create the tracker dependency.
    result = Tracker.nonreactive ->
      m.timestamp <= Session.get 'lastread'
    unless result
      Session.get 'lastread'
    result

# Template Binding
Template.messages.helpers
  ready: -> Session.equals('chatReady', true) and Template.instance().subscriptionsReady()
  # The dawn of time message has ID equal to the room name because it's
  # efficient to find it that way on the client, where there are no indexes.
  startOfChannel: -> model.Messages.findOne(_id: Session.get 'room_name', from_chat_subscription: true)?
  usefulEnough: (m) ->
    # test Session.get('nobot') last to get a fine-grained dependency
    # on the `nobot` session variable only for 'useless' messages
    myNick = Meteor.userId()
    botnick = botuser()._id
    return true if m.nick is myNick
    return true if doesMentionNick(m)
    return true if m.useful
    return true unless m.tweet? or m.nick is botnick or m.useless_cmd
    return not HIDE_USELESS_BOT_MESSAGES.get()
  presence_too_old: ->
    return false unless HIDE_OLD_PRESENCE.get()
    # If a message is too old, it will always be too old unless the option changes,
    # so don't re-evaluate the calculation every minute.
    result = Tracker.nonreactive =>
      @message.timestamp < Session.get('currentTime') - 3600000
    if !result
      Session.get 'currentTime'
    return result
  messages: ->
    return [] unless Template.instance().waitForObservers.get()
    room_name = Session.get 'room_name'
    # I will go out on a limb and say we need this because transform uses
    # doesMentionNick and transforms aren't usually reactive, so we need to
    # recompute them if you log in as someone else.
    Meteor.userId()
    return model.Messages.find {room_name, from_chat_subscription: true},
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

cleanupChat = ->
  try
    favicon.reset()
  instachat.mutationObserver?.disconnect()
  instachat.readObserver?.disconnect()
  instachat.bottomObserver?.disconnect()

Template.messages.onDestroyed ->
  cleanupChat()
  hideMessageAlert()

# window.unload is a bit spotty with async stuff, but we might as well try
$(window).unload -> cleanupChat()

Template.messages.onCreated ->
  @waitForObservers = new ReactiveVar false
  instachat.scrolledToBottom = true
  @autorun =>
    # put this in a separate autorun so it's not invalidated needlessly when
    # the limit changes.
    room_name = Session.get 'room_name'
    return unless room_name
    @subscribe 'presence-for-room', room_name
    @subscribe 'register-presence', room_name, 'chat'
    
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
      if @limitRaise?
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
      else
        Tracker.afterFlush =>
          @$(".bb-message[data-read=\"unread\"]:is(.bb-message-mention-me,[data-pm-to=\"#{Meteor.userId}\"])")[0]?.scrollIntoView()
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
    @$("#messages").each ->
      console.log "Observing #{this}" unless Meteor.isProduction
      instachat.mutationObserver.observe(this, {childList: true})
  
  @$("#messages").each ->
    instachat.readObserver.observe(this, {attributes: true, attributeFilter: ['data-read'], subtree: true})

  Meteor.defer => @waitForObservers.set true

Template.messages.events
  'click .bb-chat-load-more': (event, template) ->
    firstMessage = event.currentTarget.nextElementSibling
    offset = firstMessage.offsetTop
    template.limitRaise = [firstMessage, offset]
    Session.set 'limit', Session.get('limit') + settings.CHAT_LIMIT_INCREMENT

whos_here_helper = ->
  roomName = Session.get('type') + '/' + Session.get('id')
  return model.Presence.find {room_name: roomName, scope: 'chat'}, {sort: ['joined_timestamp']}

Template.embedded_chat.onCreated ->
  @jitsi = new ReactiveVar null
  # Intentionally staying out of the meeting.
  @jitsiLeft = new ReactiveVar false
  @jitsiPinType = new ReactiveVar null
  @jitsiPinId = new ReactiveVar null
  @jitsiType = -> @jitsiPinType.get() ? Session.get 'type'
  @jitsiId = -> @jitsiPinId.get() ? Session.get 'id'
  @jitsiInOtherTab = ->
    jitsiTabUUID = reactiveLocalStorage.getItem 'jitsiTabUUID'
    jitsiTabUUID? and jitsiTabUUID isnt settings.CLIENT_UUID
  @leaveJitsi = ->
    @jitsiLeft.set true
    @jitsi.get()?.dispose()
    @jitsi.set null
    @jitsiPinType.set null
    @jitsiPinId.set null
    @jitsiRoom = null
  @unsetCurrentJitsi = ->
    if settings.CLIENT_UUID is reactiveLocalStorage.getItem 'jitsiTabUUID'
      reactiveLocalStorage.removeItem 'jitsiTabUUID'
  $(window).on('unload', @unsetCurrentJitsi)

jitsiRoomSubject = (type, id) ->

  if 'puzzles' is type
    model.Puzzles.findOne(id).name ? 'Puzzle'
  else if '0' is id
    settings.GENERAL_ROOM_NAME
  else
    'Video Call'

Template.embedded_chat.onRendered ->
  @autorun =>
    return if @jitsiLeft.get()
    if @jitsiInOtherTab()
      @leaveJitsi()
      return
    newRoom = jitsiRoom @jitsiType(), @jitsiId()
    jitsi = @jitsi.get()
    if jitsi? and newRoom isnt @jitsiRoom
      jitsi.dispose()
      jitsi = null
      @jitsi.set null
      @jitsiRoom = null
    if newRoom?
      unless jitsi?
        jitsi = jitsiModule.createJitsiMeet newRoom, @find '#bb-jitsi-container'
        return unless jitsi?
        @jitsiRoom = newRoom
        @jitsi.set jitsi
        jitsi.on 'videoConferenceLeft', =>
          @leaveJitsi()
          reactiveLocalStorage.removeItem 'jitsiTabUUID'
        reactiveLocalStorage.setItem 'jitsiTabUUID', settings.CLIENT_UUID
      @subscribe 'register-presence', "#{@jitsiType()}/#{@jitsiId()}", 'jitsi'
  # If you reload the page the content of the user document won't be loaded yet.
  # The check that newroom is different from the current room means the display
  # name won't be set yet. This allows the display name and avatar to be set when
  # they become available. (It also updates them if they change.)
  @autorun =>
    user = Meteor.user()
    jitsi = @jitsi.get()
    return unless jitsi?
    jitsi.executeCommands
      displayName: nickAndName user
      avatarUrl: gravatarUrl
        gravatar_md5: hashFromNickObject user
        size: 200
  # The moderator should set the conference subject.
  @autorun =>
    jitsi = @jitsi.get()
    return unless jitsi?
    try
      jitsi.executeCommand 'subject', jitsiRoomSubject(@jitsiType(), @jitsiId())

Template.embedded_chat.onDestroyed ->
  @unsetCurrentJitsi()
  $(window).off('unload', @unsetCurrentJitsi)
  @jitsi.get()?.dispose()

nickAndName = (user) -> 
  if user?.real_name?
    "#{user.real_name} (#{user.nickname})"
  else
    user.nickname

Template.embedded_chat.helpers
  inJitsi: -> Template.instance().jitsi.get()?
  canJitsi: ->
    return jitsiRoom(Session.get('type'), Session.get('id'))? and Template.instance().jitsiLeft.get()
  otherJitsi: -> Template.instance().jitsiInOtherTab()
  jitsiSize: ->
    # Set up dependencies
    return unless Template.instance().jitsi.get()?
    sizeWouldBe = Math.floor(share.Splitter.hsize.get() * 9 / 16)
    if CAP_JITSI_HEIGHT.get()
      return Math.min 75, sizeWouldBe
    sizeWouldBe
  jitsiPinSet: -> Template.instance().jitsiPinType.get()?
  jitsiUrl: -> jitsiUrl Session.get('type'), Session.get('id')
  usingJitsiPin: ->
    instance = Template.instance()
    jitsiRoom(instance.jitsiType(), instance.jitsiId()) isnt jitsiRoom(Session.get('type'), Session.get('id'))
  pinnedRoomName: ->
    instance = Template.instance()
    jitsiRoomSubject instance.jitsiType(), instance.jitsiId()
  pinnedRoomUrl: ->
    instance = Template.instance()
    return Meteor._relativeToSiteRootUrl '/' if instance.jitsiType() is 'general'
    share.Router.urlFor instance.jitsiType(), instance.jitsiId()

Template.embedded_chat.events
  'click .bb-join-jitsi': (event, template) ->
    reactiveLocalStorage.setItem 'jitsiTabUUID', settings.CLIENT_UUID
    template.jitsiLeft.set false
  'click .bb-pop-jitsi': (event, template) ->
    template.leaveJitsi()
  'click .bb-jitsi-pin': (event, template) ->
    template.jitsiPinType.set Session.get 'type'
    template.jitsiPinId.set Session.get 'id'
  'click .bb-jitsi-unpin': (event, template) ->
    template.jitsiPinType.set null
    template.jitsiPinId.set null
  'click .bb-jitsi-cap-height:not(.capped)': (event, template) ->
    CAP_JITSI_HEIGHT.set true
  'click .bb-jitsi-cap-height.capped': (event, template) ->
    CAP_JITSI_HEIGHT.set false

# Utility functions

regex_escape = (s) -> s.replace /[$-\/?[-^{|}]/g, '\\$&'

GLOBAL_MENTIONS = /@(channel|everyone)/i

doesMentionNick = (doc, raw_nick=Meteor.userId()) ->
  return false unless raw_nick
  nick = canonical raw_nick
  return false if nick is doc.nick # messages from yourself don't count
  return true if doc.to is nick # PMs to you count
  return true if doc.mention?.includes nick # Mentions count
  return false unless doc.body?
  return false if doc.system # system messages don't count as mentions
  return false if doc.bodyIsHtml # XXX we could fix this
  # These things are treated as mentions for everyone
  GLOBAL_MENTIONS.test(doc.body)

isVisible = share.isVisible = do ->
  _visible = new ReactiveVar()
  onVisibilityChange = -> _visible.set !(document.hidden or false)
  document.addEventListener 'visibilitychange', onVisibilityChange, false
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

Template.chat_format_body.helpers
  chunks: ->
    if @bodyIsHtml
      chunk_html @body
    else
      chunk_text @body
  chunk_template: (type) ->
    if type is 'url'
      'text_chunk_url_image'
    else
      "text_chunk_#{type}"

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

Template.messages_input.helpers
  show_presence: -> Template.instance().show_presence.get()
  whos_here: whos_here_helper
  nickAndName: (nick) ->
    user = Meteor.users.findOne canonical nick ? {nickname: nick}
    nickAndName user
  typeaheadResults: -> Template.instance().queryCursor.get()
  selected: (id) -> 
    return Template.instance().selected.get() is id
  error: -> Template.instance().error.get()

MSG_PATTERN = /^\/m(sg)? ([A-Za-z_0-9]*)$/
MSG_AT_START_PATTERN = /^\/m(sg)? /
AT_MENTION_PATTERN = /(^|[\s])@([A-Za-z_0-9]*)$/

Template.messages_input.onCreated ->
  @show_presence = new ReactiveVar false
  @query = new ReactiveVar null
  @queryCursor = new ReactiveVar null
  @selected = new ReactiveVar null
  @error = new ReactiveVar null

  @setQuery = (query) ->
    return if @query.get() is query
    @query.set query
    unless query
      @queryCursor.set null
      @selected.set null
      return
    qdoc = {$regex: query, $options: 'i'}
    c = Meteor.users.find
      $or: [{_id: qdoc}, {real_name: qdoc}]
    ,
      limit: 8
      fields: _id: 1
      sort: {_id: 1}
    @queryCursor.set c
    s = @selected.get()
    l = c.map (x) -> x._id 
    return if l.includes s
    @selected.set l[0]

  @moveActive = (offset) =>
    s = @selected.get()
    return unless s?
    c = @queryCursor.get()
    return unless c?
    l = c.map (x) -> x._id
    i = offset + l.indexOf s
    i = l.length - 1 if i < 0
    i = 0 if i >= l.length
    @selected.set l[i]

  @autorun =>
    c = @queryCursor.get()
    return unless c
    c.observe
      removedAt: (old, at) =>
        @activateFirst() if @selected.get() is old._id

  @activateFirst = ->
    c = @queryCursor.get()
    unless c
      @selected.set null
      return
    id = c.fetch()[0]
    @selected.set id?._id

  @updateTypeahead = ->
    i = @$('#messageInput')
    v = i.val()
    ss = i.prop 'selectionStart'
    se = i.prop 'selectionEnd'
    if ss isnt se
      @setQuery null
      return
    tv = v.substring ss
    nextSpace = tv.search /[\s]/
    consider = if nextSpace is -1 then v else v.substring 0, (ss + nextSpace)
    match = consider.match MSG_PATTERN
    if match
      @setQuery match[2]
    else if MSG_AT_START_PATTERN.test v
      # no mentions in private messages.
      @setQuery null
      return
    else
      match = consider.match AT_MENTION_PATTERN
      if match
        @setQuery match[2]
      else
        @setQuery null
        return

  @confirmTypeahead = (nick) ->
    @setQuery null
    i = @$('#messageInput')
    v = i.val()
    ss = i.prop 'selectionStart'
    tv = v.substring ss
    nextSpace = tv.search /[\s]/
    consider = if nextSpace is -1 then v else v.substring 0, (ss + nextSpace)
    match = consider.match MSG_PATTERN
    if match
      i.val v.substring(0, match[0].length - match[2].length) + nick + ' ' + v.substring(consider.length)
      newCaret = match[0].length - match[2].length + nick.length + 1
      i.focus()
      i[0].setSelectionRange newCaret, newCaret
      return
    match = consider.match AT_MENTION_PATTERN
    if match
      i.val v.substring(0, consider.length - match[2].length) + nick + ' ' + v.substring(consider.length)
      newCaret = consider.length - match[2].length + nick.length + 1
      i.focus()
      i[0].setSelectionRange newCaret, newCaret
    
  @submit = (message) ->
    return false unless message
    args =
      room_name: Session.get 'room_name'
      body: message
    [word1, rest] = message.split(/\s+([^]*)/, 2)
    switch word1
      when "/me"
        args.body = rest
        args.action = true
      when "/join"
        result = model.Names.findOne {canon: canonical(rest.trim()), type: $in: ['rounds', 'puzzles']}
        if (not result?) and GENERAL_ROOM_REGEX.test(rest.trim())
          result = {type:'general', _id:'0'}
        if error? or not result?
          @error.set 'unknown chat room'
          return false
        hideMessageAlert()
        joinRoom result.type, result._id
        return true
      when "/msg", "/m"
        # find who it's to
        [to, rest] = rest.split(/\s+([^]*)/, 2)
        missingMessage = (not rest)
        while rest
          n = Meteor.users.findOne canonical to
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
          error = if missingMessage
            'tried to say nothing'
          else
            'Unknown recipient'
          @error.set error
          return false
    unless args.to?
      # Can't mention someone in a private message
      mentions = for match from args.body.matchAll /(^|[\s])@([a-zA-Z_0-9]*)([\s.?!,]|$)/g
        canon = canonical match[2]
        continue unless Meteor.users.findOne(canon)?
        canon
      args.mention = mentions if mentions.length
    Meteor.call 'newMessage', args # updates LastRead as a side-effect
    # for flicker prevention, we are currently not doing latency-compensation
    # on the newMessage call, which makes the below ineffective.  But leave
    # it here in case we turn latency compensation back on.
    Tracker.afterFlush -> scrollMessagesView()
    @history_ts = null
    return true

format_body = (msg) ->
  if msg.action
    return "/me #{msg.body}"
  if msg.to?
    return "/msg #{msg.to} #{msg.body}"
  msg.body

Template.messages_input.events
  'click .bb-show-whos-here': (event, template) ->
    rvar = template.show_presence
    rvar.set(not rvar.get())
  "keydown textarea": (event, template) ->
    template.error.set null
    if ['Up', 'ArrowUp'].includes(event.key) 
      if template.query.get()?
        event.preventDefault()
        template.moveActive -1
      else if event.target.selectionEnd is 0
        # Checking that the cursor is at the start of the box.
        query =
          room_name: Session.get 'room_name'
          nick: Meteor.userId()
          system: $ne: true
          bodyIsHtml: $ne: true
          from_chat_subscription: true
        if template.history_ts?
          query.timestamp = $lt: template.history_ts
        msg = model.Messages.findOne query,
          sort: timestamp: -1
        if msg?
          template.history_ts = msg.timestamp
          event.target.value = format_body msg
          event.target.setSelectionRange 0, 0
        return
    if ['Down', 'ArrowDown'].includes(event.key)
      if template.query.get()?
        event.preventDefault()
        template.moveActive 1
      else if event.target.selectionStart is event.target.value.length
        # 40 is arrow down. Checking that the cursor is at the end of the box.
        return unless template.history_ts?
        # Pushing down only means anything if you're in history.
        query =
          room_name: Session.get 'room_name'
          nick: Meteor.userId()
          system: $ne: true
          bodyIsHtml: $ne: true
          timestamp: $gt: template.history_ts
          from_chat_subscription: true
        msg = model.Messages.findOne query,
          sort: timestamp: 1
        if msg?
          template.history_ts = msg.timestamp
          body = format_body msg
          event.target.value = body
          event.target.setSelectionRange body.length, body.length
        else
          event.target.value = ''
          template.history_ts = null
        return

    if event.which is 13 and not (event.shiftKey or event.ctrlKey)
      event.preventDefault() # prevent insertion of enter
      s = template.selected.get()
      if s?
        # Autocomplete if relevant.
        template.confirmTypeahead s
      else
        # implicit submit on enter (but not shift-enter or ctrl-enter)
        $message = $ event.currentTarget
        message = $message.val()
        if template.submit message
          $message.val ""

    # Tab also autocompletes
    if event.key is 'Tab'
      s = template.selected.get()
      if s?
        event.preventDefault()
        template.confirmTypeahead s

  'blur #messageInput': (event, template) ->
    # alert for unread messages
    instachat.alertWhenUnreadMessages = true
  'focus #messageInput': (event, template) -> 
    updateLastRead() if instachat.ready # skip during initial load
    instachat.alertWhenUnreadMessages = false
    hideMessageAlert()
  'keyup/click/touchend/mouseup #messageInput': (event, template) ->
    template.updateTypeahead()
  'click #messageInputTypeahead a[data-value]': (event, template) ->
    event.preventDefault()
    template.confirmTypeahead event.currentTarget.dataset.value
  'mouseenter #messageInputTypeahead': (event, template) ->
    template.selected.set null
  'mouseleave #messageInputTypeahead': (event, template) ->
    template.activateFirst()

updateLastRead = ->
  lastMessage = model.Messages.findOne
    room_name: Session.get 'room_name'
    from_chat_subscription: true
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
    updateLastRead() if isVisible() and instachat.ready

Template.chat.onRendered ->
  $(window).resize()
  type = Session.get('type')
  id = Session.get('id')
  joinRoom type, id

# App startup
Meteor.startup ->
  return unless typeof Audio is 'function' # for phantomjs
  instachat.messageMentionSound = new Audio(Meteor._relativeToSiteRootUrl '/sound/Electro_-S_Bainbr-7955.wav')

updateNotice = do ->
  [lastUnread, lastMention] = [0, 0]
  (unread, mention) ->
    if mention > lastMention and instachat.ready
      unless MUTE_SOUND_EFFECTS.get()
        instachat.messageMentionSound?.play?()?.catch? (err) -> console.error err.message, err
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
  lastread = model.LastRead.findOne room_name
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
    from_chat_subscription: true
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
  hideMessageAlert: hideMessageAlert
  joinRoom: joinRoom
  # for debugging
  instachat: instachat
