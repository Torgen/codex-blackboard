'use strict'

import canonical from '../lib/imports/canonical.coffee'
import { emailFromNickObject } from './imports/nickEmail.coffee'
import botuser from './imports/botuser.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'

model = share.model # import
settings = share.settings # import

# templates, event handlers, and subscriptions for the site-wide
# header bar, including the login modals and general Spacebars helpers

keyword_or_positional = share.keyword_or_positional = (name, args) ->
  return args.hash unless (not args?) or \
    (typeof(args) is 'string') or (typeof(args) is 'number')
  a = {}
  a[name] = args
  return a

# link various types of objects
Template.registerHelper 'link', (args) ->
  args = keyword_or_positional 'id', args
  return "" unless args.id
  n = model.Names.findOne(args.id)
  return args.id.slice(0,8) unless n
  return ('' + (args.text ? n.name)) if args.editing
  extraclasses = if args.class then (' '+args.class) else ''
  title = ''
  if args.title?
    title = ' title="' + \
      args.title.replace(/[&\"]/g, (c) -> '&#' + c.charCodeAt(0) + ';') + '"'
  prefix = if args.chat then '/chat' else ''
  type = if args.chat then 'chat' else n.type
  link = "<a href='#{prefix}/#{n.type}/#{n._id}' class='#{type}-link#{extraclasses}' #{title}>"
  if args.icon
    link += "<i class='#{args.icon}'></i>"
  else
    link += UI._escape('' + (args.text ? n.name))
  link += '</a>'
  return new Spacebars.SafeString(link)

do ->
  clickHandler = (event, template) ->
    return unless event.button is 0 # check right-click
    return if event.ctrlKey or event.shiftKey or event.altKey or event.metaKey # check alt/ctrl/shift/command clicks
    target = event.currentTarget
    # href on the element directly is absolute. We want the relative path if it exists for routing.
    rawHref = target.getAttribute 'href'
    return if /^https?:/.test rawHref
    event.preventDefault()
    if target.classList.contains 'bb-pop-out'
      # here we want the absolute path since it's for a new window.
      window.open target.href, 'Pop out', \
        ("height=480,width=480,menubar=no,toolbar=no,personalbar=no,"+\
        "status=yes,resizeable=yes,scrollbars=yes")
    else
      share.Router.navigate rawHref, {trigger:true}
  Template.page.events
    'click a.puzzles-link': clickHandler
    'click a.rounds-link': clickHandler
    'click a.chat-link': clickHandler
    'click a.graph-link': clickHandler
    'click a.home-link': clickHandler
    'click a.oplogs-link': clickHandler
    'click a.quips-link': clickHandler
    'click a.callins-link': clickHandler
    'click a.facts-link': clickHandler

Template.registerHelper 'drive_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.drive_id_to_link(args.id)
Template.registerHelper 'spread_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.spread_id_to_link(args.id)
Template.registerHelper 'doc_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.doc_id_to_link(args.id)

# nicks
Template.registerHelper 'nickOrName', (args) ->
  nick = (keyword_or_positional 'nick', args).nick
  n = Meteor.users.findOne canonical nick
  return n?.real_name or n?.nickname or nick

Template.registerHelper 'lotsOfPeople', (args) ->
  count = (keyword_or_positional 'count', args).count
  return count > 4

# gravatars
Template.registerHelper 'gravatar', (args) ->
  args = keyword_or_positional 'id', args
  args.secure = true
  g = $.gravatar(args.id, args)
  # hacky cross-platform version of 'outerHTML'
  html = $('<div>').append( g.eq(0).clone() ).html()
  return new Spacebars.SafeString(html)

today_fmt = Intl.DateTimeFormat navigator.language,
  hour: 'numeric'
  minute: 'numeric'
past_fmt = Intl.DateTimeFormat navigator.language,
  hour: 'numeric'
  minute: 'numeric'
  weekday: 'short'

# timestamps
Template.registerHelper 'pretty_ts', (args) ->
  args = keyword_or_positional 'timestamp', args
  timestamp = args.timestamp
  return unless timestamp
  style = (args.style or "time")
  switch (style)
    when "time"
      diff = (Session.get('currentTime') or model.UTCNow()) - timestamp
      d = new Date timestamp
      if diff > 86400000
        return past_fmt.format d
      today_fmt.format d
    when "duration", "brief_duration", "brief duration", 'seconds_since'
      brief = (style isnt 'duration')
      duration = (Session.get('currentTime') or model.UTCNow()) - timestamp
      seconds = Math.floor(duration/1000)
      return seconds if style is 'seconds_since'
      return "in the future" if seconds < -60
      return "just now" if seconds < 60
      [minutes, seconds] = [Math.floor(seconds/60), seconds % 60]
      [hours,   minutes] = [Math.floor(minutes/60), minutes % 60]
      [days,    hours  ] = [Math.floor(hours  /24), hours   % 24]
      [weeks,   days   ] = [Math.floor(days   / 7), days    % 7]
      ago = (s) -> (s.replace(/^\s+/,'') + " ago")
      s = ""
      s += " #{weeks} week" if weeks > 0
      s += "s" if weeks > 1
      return ago(s) if s and brief
      s += " #{days} day" if days > 0
      s += "s" if days > 1
      return ago(s) if s and brief
      s += " #{hours} hour" if hours > 0
      s += "s" if hours > 1
      return ago(s) if s and brief
      s += " #{minutes} minute" if minutes > 0
      s += "s" if minutes > 1
      return ago(s)
    else
      "Unknown timestamp style: #{style}"

############## log in/protect/mute panel ####################
Template.header_loginmute.helpers
  volumeIcon: ->
    if 'true' is reactiveLocalStorage.getItem 'mute' then 'fa-volume-mute' else 'fa-volume-up'
  volumeTitle: ->
    if 'true' is reactiveLocalStorage.getItem 'mute' then 'Muted' else 'Click to mute'
  botIcon: ->
    if 'true' is reactiveLocalStorage.getItem 'nobot' then 'icon-bot-off' else 'icon-bot-on'
  botTitle: ->
    botName = botuser()?.nickname or 'The bot'
    if 'true' is reactiveLocalStorage.getItem 'nobot'
      "#{botName} promises not to bother you"
    else
      "#{botName} is feeling chatty!"
  sessionNick: -> # TODO(torgen): replace with currentUser
    user = Meteor.user()
    return unless user?
    {
      name: user.nickname
      canon: user._id
      realname: user.real_name or user.nickname
      gravatar: emailFromNickObject user
    }

Template.header_loginmute.events
  "click .bb-logout": (event, template) ->
    event.preventDefault()
    Meteor.logout()
  "click .bb-unprotect": (event, template) ->
    share.Router.navigate "/edit", {trigger: true}
  "click .bb-protect": (event, template) ->
    share.Router.navigate "/", {trigger: true}

Template.connection_button.helpers
  connectStatus: Meteor.status

Template.connection_button.events
  "click .connected, click .connecting, click .waiting": (event, template) ->
    Meteor.disconnect()
  "click .failed, click .offline": (event, template) ->
    Meteor.reconnect()

fillMetas = (metas, currentid) ->
  puzzle = model.Puzzles.findOne currentid
  if puzzle?.feedsInto?
    for p in puzzle.feedsInto
      unless metas[p]?
        metas[p] = p
        fillMetas metas, p

############## breadcrumbs #######################

crumbs_equal = (x, y) ->
  return false unless x.length is y.length
  for xi, i in x
    yi = y[i]
    return false unless xi.type is yi.type
    return false unless xi.page is yi.page
    continue if xi.id is yi.id
    return false unless 'object' is typeof xi.id
    return false unless 'object' is typeof yi.id
    return false unless Object.keys(xi.id).length is Object.keys(yi.id).length
    for k, v of xi.id
      return false unless yi.id[k]?
      return false unless yi.id[k] is v
  true

breadcrumbs_var = new ReactiveVar [{page: 'blackboard', type: 'general', id: '0'}], crumbs_equal

in_crumbs = (crumbs, type, id) ->
  return false unless crumbs?
  for crumb in crumbs
    continue unless crumb.type is type
    if crumb.page is 'metas'
      return true if crumb.id[id]?
    else
      return true if crumb.id is id
  false

# One autorun to determine if the current page should be the leaf.
# Basically, if the current page isn't in the current breadcrumb trail,
# it should be the leaf.
Tracker.autorun ->
  breadcrumbs = breadcrumbs_var.get()
  type = Session.get 'type'
  id = Session.get 'id'
  unless in_crumbs breadcrumbs, type, id
    Session.set
      breadcrumbs_leaf_type: type
      breadcrumbs_leaf_id: id

# Because our graph is unweighted, BFS suffices--we don't need something fancy
# like Dijkstra.
min_meta_paths = (root) ->
  depth = 0
  current = [root]
  next = {}
  depths = {}
  trail = []
  depths[root] = -1
  loop
    for id in current
      puzzle = model.Puzzles.findOne id
      continue unless puzzle?
      for meta in puzzle.feedsInto
        unless depths[meta]?
          depths[meta] = depth
          next[meta] = depth
    current = Object.keys next
    unless current.length
      return trail
    trail.push next
    depth++
    next = {}

generate_crumbs = (leaf_type, leaf_id) ->
  crumbs = [{page: 'blackboard', type: 'general', id: '0'}]
  leaf_type = Session.get 'breadcrumbs_leaf_type'
  leaf_id = Session.get 'breadcrumbs_leaf_id'
  return crumbs unless leaf_type? and leaf_id?
  if leaf_type is 'puzzles'
    metas = min_meta_paths leaf_id
    # Deepest are last here, so...
    metas.reverse()
    # One breadcrumb for each level of meta.
    # Consider grouping together beyond some number of levels
    for meta in metas
      crumbs.push {page: 'metas', type: 'puzzles', id: meta}
    crumbs.push {page: 'puzzle', type: 'puzzles', id: leaf_id}
  else if leaf_type is 'rounds'
    crumbs.push {page: 'round', type: 'rounds', id: leaf_id}
  else if leaf_type is 'quips'
    crumbs.push {page: 'quip', type: 'quips', id: leaf_id}
  else
    unless leaf_type is 'general'
      crumbs.push {page: leaf_type, type: leaf_type, id: leaf_id}
  crumbs

# A second autorun to determine what should be in the crumbs. 
# Basically, if the current type/id is the leaf, always regenerate the crumbs
# from the breadcrumb leaf.
# Otherwise generate them only if the current type/id appears in the new trail.
# This stops the current crumb from vanishing if you're viewing a meta above a
# puzzle when the puzzle is removed from the meta.
Tracker.autorun ->
  leaf_type = Session.get 'breadcrumbs_leaf_type'
  leaf_id = Session.get 'breadcrumbs_leaf_id'
  crumbs = generate_crumbs leaf_type, leaf_id
  type = Session.get 'type'
  id = Session.get 'id'
  unless type is leaf_type and id is leaf_id
    return unless in_crumbs crumbs, type, id
  breadcrumbs_var.set crumbs

Template.header_breadcrumb_chat.helpers
  inThisRoom: ->
    return false unless Session.equals 'currentPage', 'chat'
    return false unless Session.equals 'type', @type
    Session.equals 'id', @id

active = ->
  Session.equals('type', @type) and Session.equals('id', @id)

Template.header_breadcrumb_blackboard.helpers
  active: active

Template.header_breadcrumb_callins.helpers
  active: active

Template.header_breadcrumb_extra_links.helpers
  active: -> active.call(Template.parentData(1))

Template.header_breadcrumb_round.onCreated ->
  @autorun =>
    @subscribe 'round-by-id', Template.currentData().id
Template.header_breadcrumb_round.helpers
  round: -> model.Rounds.findOne @id if @id
  active: active

Template.header_breadcrumb_metas.helpers
  active_meta: ->
    return unless Session.equals 'type', @type
    id = Session.get 'id'
    if @id[id]?
      return id
  inactive_metas: ->
    keys = Object.keys @id
    if Session.equals 'type', @type
      id = Session.get 'id'
      keys = keys.filter (x) -> x isnt id
    if keys.length is 1
      one: keys[0]
      all: keys
    else if keys.length is 0
      {}
    else
      all: keys

Template.header_breadcrumb_one_meta.onCreated ->
  @autorun =>
    @subscribe 'puzzle-by-id', Template.currentData().id
    @subscribe 'metas-for-puzzle', Template.currentData().id
Template.header_breadcrumb_one_meta.helpers
  puzzle: -> model.Puzzles.findOne @id if @id
  active: active

Template.header_breadcrumb_puzzle.onCreated ->
  @autorun =>
    @subscribe 'puzzle-by-id', Template.currentData().id
    @subscribe 'metas-for-puzzle', Template.currentData().id
Template.header_breadcrumb_puzzle.helpers
  puzzle: -> model.Puzzles.findOne @id if @id
  active: active

Template.header_breadcrumb_quip.onCreated ->
  @autorun => @subscribe 'quips'
Template.header_breadcrumb_quip.helpers
  idIsNew: -> 'new' is @id
  quip: -> model.Quips.findOne @id

Template.header_breadcrumbs.onCreated ->
  @autorun =>
    Meteor.call 'getRinghuntersFolder', (error, f) ->
      unless error?
        Session.set 'RINGHUNTERS_FOLDER', (f or undefined)

Template.header_breadcrumbs.helpers
  breadcrumbs: -> breadcrumbs_var.get()
  crumb_template: -> "header_breadcrumb_#{@page}"
  active: active
  puzzle: ->
    if Session.equals 'type', 'puzzles'
      model.Puzzles.findOne Session.get 'id'
    else null
  picker: -> settings.PICKER_CLIENT_ID? and settings.PICKER_APP_ID? and settings.PICKER_DEVELOPER_KEY?
  drive: -> switch Session.get 'type'
    when 'general'
      Session.get 'RINGHUNTERS_FOLDER'
    when 'puzzles'
      model.Puzzles.findOne(Session.get 'id')?.drive

Template.header_breadcrumbs.events
  "click .bb-upload-file": (event, template) ->
    folder = switch Session.get 'type'
      when 'general'
        Session.get 'RINGHUNTERS_FOLDER'
      when 'puzzles'
        model.Puzzles.findOne(Session.get 'id')?.drive
    return unless folder
    uploadToDriveFolder folder, (docs) ->
      message = "uploaded "+(for doc in docs
        "<a href='#{UI._escape doc.url}' target='_blank'><img src='#{UI._escape doc.iconUrl}' />#{UI._escape doc.name}</a> "
      ).join(', ')
      Meteor.call 'newMessage',
        body: message
        bodyIsHtml: true
        action: true
        room_name: Session.get('type')+'/'+Session.get('id')

Template.header_breadcrumbs.onRendered ->
  # tool tips
  $(this.findAll('a.bb-drive-link[title]')).tooltip placement: 'bottom'

uploadToDriveFolder = share.uploadToDriveFolder = (folder, callback) ->
  google = window?.google
  gapi = window?.gapi
  unless google? and gapi?
    console.warn 'Google APIs not loaded; Google Drive disabled.'
    return
  uploadView = new google.picker.DocsUploadView()\
    .setParent(folder)
  pickerCallback = (data) ->
    switch data[google.picker.Response.ACTION]
      when "loaded"
        return
      when google.picker.Action.PICKED
        doc = data[google.picker.Response.DOCUMENTS][0]
        url = doc[google.picker.Document.URL]
        callback data[google.picker.Response.DOCUMENTS]
      else
        console.log 'Unexpected action:', data
  gapi.auth.authorize
    client_id: settings.PICKER_CLIENT_ID
    scope: ['https://www.googleapis.com/auth/drive']
    immediate: false
  , (authResult) ->
    oauthToken = authResult?.access_token
    if authResult?.error or !oauthToken
      console.log 'Authentication failed', authResult
      return
    new google.picker.PickerBuilder()\
      .setAppId(settings.PICKER_APP_ID)\
      .setDeveloperKey(settings.PICKER_DEVELOPER_KEY)\
      .setOAuthToken(oauthToken)\
      .setTitle('Upload Item')\
      .addView(uploadView)\
      .enableFeature(google.picker.Feature.NAV_HIDDEN)\
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)\
      .setCallback(pickerCallback)\
      .build().setVisible true


############## nick selection ####################

Template.header_nickmodal_contents.onCreated ->
  # we'd need to subscribe to 'all-nicks' here if we didn't have a permanent
  # subscription to it (in main.coffee)
  this.typeaheadSource = (query,process) =>
    this.update(query)
    (n.nickname for n in Meteor.users.find(bot_wakeup: $exists: false).fetch())
  this.update = (query, options) =>
    # can we find an existing nick matching this?
    n = if query then Meteor.users.findOne canonical query else undefined
    if (n or options?.force)
      realname = n?.real_name
      gravatar = n?.gravatar
      $('#nickRealname').val(realname or '')
      $('#nickEmail').val(gravatar or '')
    this.updateGravatar(query)
  this.updateGravatar = (q) =>
    email = $('#nickEmail').val() or "#{q or model.canonical($('#nickInput').val())}@#{settings.DEFAULT_HOST}"
    gravatar = $.gravatar email,
      image: 'wavatar' # 'monsterid'
      classes: 'img-polaroid'
      secure: true
    container = $(this.find('.gravatar'))
    if container.find('img').length
      container.find('img').attr('src', gravatar.attr('src'))
    else
      container.append(gravatar)
nickInput = new Tracker.Dependency
Template.header_nickmodal_contents.helpers
  disabled: ->
    nickInput.depend()
    Meteor.loggingIn() or not $('#nickInput').val()
Template.header_nickmodal_contents.onRendered ->
  $('#nickSuccess').val('false')
  $('#nickPickModal').modal keyboard: false, backdrop:"static"
  $('#nickInput').select()
  firstNick = Meteor.userId() or ''
  $('#nickInput').val firstNick
  this.update firstNick, force:true
  $('#nickInput').typeahead
    source: this.typeaheadSource
    updater: (item) =>
      this.update(item)
      return item
Template.header_nickmodal_contents.events
  "click .bb-submit": (event, template) ->
    $('#nickPick').submit()
  'input #nickInput': (event, template) ->
    nickInput.changed()
  "keydown #nickInput": (event, template) ->
    # implicit submit on <enter> if typeahead isn't shown
    if event.which is 13 and not $('#nickInput').data('typeahead').shown
      $('#nickPick').submit()
  "keydown #nickRealname": (event, template) ->
    $('#nickEmail').select() if event.which is 13
  "keydown #nickEmail": (event, template) ->
    $('#nickPick').submit() if event.which is 13
  "input #nickEmail": (event, template) ->
    template.updateGravatar()
  'submit #nickPick': (event, template) ->
    nick = $("#nickInput").val().replace(/^\s+|\s+$/g,"") #trim
    return false unless nick
    Meteor.loginWithCodex nick, $('#nickRealname').val(), $('#nickEmail').val(), $('#passwordInput').val(), (err, res) ->
      if err?
        le = $("#loginError")
        if err.reason?
          le.text err.reason
    return false

############## confirmation dialog ########################
Template.header_confirmmodal.helpers
  confirmModalVisible: -> !!(Session.get 'confirmModalVisible')
Template.header_confirmmodal_contents.onRendered ->
  $('#confirmModal .bb-confirm-cancel').focus()
  $('#confirmModal').modal show: true
Template.header_confirmmodal_contents.events
  "click .bb-confirm-ok": (event, template) ->
    Template.header_confirmmodal_contents.cancel = false # do the thing!
    $('#confirmModal').modal 'hide'

confirmationDialog = share.confirmationDialog = (options) ->
  $('#confirmModal').one 'hide', ->
    Session.set 'confirmModalVisible', undefined
    options.ok?() unless Template.header_confirmmodal_contents.cancel
  # store away options before making dialog visible
  Template.header_confirmmodal_contents.options = -> options
  Template.header_confirmmodal_contents.cancel = true
  Session.set 'confirmModalVisible', (options or Object.create(null))

OPLOG_COLLAPSE_LIMIT = 10

############## operation log in header ####################
Template.header_lastupdates.helpers
  lastupdates: ->
    ologs = model.Messages.find {room_name: "oplog/0", dawn_of_time: $ne: true}, \
          {sort: [["timestamp","desc"]], limit: OPLOG_COLLAPSE_LIMIT}
    ologs = ologs.fetch()
    # now look through the entries and collect similar logs
    # this way we can say "New puzzles: X, Y, and Z" instead of just
    # "New Puzzle: Z"
    return '' unless ologs && ologs.length
    message = [ ologs[0] ]
    for ol in ologs[1..]
      if ol.body is message[0].body and ol.type is message[0].type
        message.push ol
      else
        break
    type = ''
    if message[0].id
      type = ' ' + model.pretty_collection(message[0].type) + \
        (if message.length > 1 then 's ' else ' ')
    uniq = (array) ->
      seen = Object.create(null)
      ((seen[o.id]=o) for o in array when not (o.id of seen))
    return {
      timestamp: message[0].timestamp
      message: message[0].body + type
      nick: message[0].nick
      objects: uniq({type:m.type,id:m.id} for m in message)
    }

# subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastupdates.onCreated ->
  this.autorun =>
    this.subscribe 'recent-messages', 'oplog/0', OPLOG_COLLAPSE_LIMIT
# add tooltip to 'more' links
do ->
  for t in ['header_lastupdates', 'header_lastchats']
    Template[t].onRendered ->
      $(this.findAll('.right a[title]')).tooltip placement: 'left'

RECENT_GENERAL_LIMIT = 2

############## chat log in header ####################
Template.header_lastchats.helpers
  lastchats: ->
    m = model.Messages.find {
      room_name: "general/0", system: {$ne: true}, bodyIsHtml: {$ne: true}
    }, {sort: [["timestamp","desc"]], limit: RECENT_GENERAL_LIMIT}
    m = m.fetch().reverse()
    return m
  msgbody: ->
    if this.bodyIsHtml then new Spacebars.SafeString(this.body) else this.body
  roomname: -> settings.GENERAL_ROOM_NAME

# subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastchats.onCreated ->
  return if settings.BB_DISABLE_RINGHUNTERS_HEADER
  @autorun =>
    @subscribe 'recent-header-messages'
