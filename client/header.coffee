'use strict'
model = share.model # import
settings = share.settings # import

# templates, event handlers, and subscriptions for the site-wide
# header bar, including the login modals and general Spacebars helpers

Meteor.startup ->
  Meteor.call 'getRinghuntersFolder', (error, f) ->
    unless error?
      Session.set 'RINGHUNTERS_FOLDER', (f or undefined)

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

$(document).on 'click', 'a.puzzles-link, a.rounds-link, a.chat-link, a.home-link, a.oplogs-link, a.quips-link, a.callins-link, a.facts-link', (event) ->
  return unless event.button is 0 # check right-click
  return if event.ctrlKey or event.shiftKey or event.altKey # check alt/ctrl/shift clicks
  return if /^https?:/.test($(event.currentTarget).attr('href'))
  event.preventDefault()
  if $(this).hasClass('bb-pop-out')
    window.open $(event.currentTarget).attr('href'), 'Pop out', \
      ("height=480,width=480,menubar=no,toolbar=no,personalbar=no,"+\
       "status=yes,resizeable=yes,scrollbars=yes")
  else
    share.Router.navigate $(this).attr('href'), {trigger:true}

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
  n = model.Nicks.findOne canon: model.canonical(nick)
  return model.getTag(n, 'Real Name') or nick

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
    when "duration", "brief_duration", "brief duration"
      brief = (style isnt 'duration')
      duration = (Session.get('currentTime') or model.UTCNow()) - timestamp
      seconds = Math.floor(duration/1000)
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
    if 'true' is reactiveLocalStorage.getItem 'mute' then 'icon-volume-off' else 'icon-volume-up'
  volumeTitle: ->
    if 'true' is reactiveLocalStorage.getItem 'mute' then 'Muted' else 'Click to mute'
  botIcon: ->
    if 'true' is reactiveLocalStorage.getItem 'nobot' then 'icon-bot-off' else 'icon-bot-on'
  connectStatus: Meteor.status
  botTitle: ->
    if 'true' is reactiveLocalStorage.getItem 'nobot'
      "Codexbot promises not to bother you"
    else
      "Codexbot is feeling chatty!"
  sessionNick: ->
    nick = reactiveLocalStorage.getItem 'nick'
    return nick unless nick
    n = model.Nicks.findOne canon: model.canonical(nick)
    cn = n?.canon or model.canonical(nick)
    return {
      name: n?.name or nick
      canon: cn
      realname: model.getTag n, 'Real Name'
      gravatar: (model.getTag n, 'Gravatar') or "#{cn}@#{settings.DEFAULT_HOST}"
    }

Template.header_loginmute.onRendered ->
  # tool tips
  $(this.findAll('.bb-buttonbar *[title]')).tooltip
    placement: 'bottom'
    container: '.bb-buttonbar'

Template.header_loginmute.events
  "click .bb-login": (event, template) ->
    event.preventDefault()
    ensureNick()
  "click .bb-logout": (event, template) ->
    event.preventDefault()
    share.chat.cleanupChat() if Session.equals('currentPage', 'chat')
    reactiveLocalStorage.removeItem 'nick'
  "click .bb-unprotect": (event, template) ->
    ensureNick ->
      share.Router.navigate "/edit", {trigger: true}
  "click .bb-protect": (event, template) ->
    share.Router.navigate "/", {trigger: true}
  "click .connected, click .connecting, click .waiting": (event, template) ->
    Meteor.disconnect()
  "click .failed, click .offline": (event, template) ->
    Meteor.reconnect()

############## breadcrumbs #######################
Tracker.autorun ->
  breadcrumbs = Session.get 'breadcrumbs'
  currentpage = Session.get 'currentPage'
  currenttype = Session.get 'type'
  currentid = Session.get 'id'
  # Regenerate breadcrumbs
  base = [{page: 'blackboard', type: 'general', id: '0'}]
  if currenttype is 'puzzles'
    round = model.Rounds.findOne puzzles: currentid
    if round?
      base.push {page: 'round', type: 'rounds', id: round._id}
    base.push {page: 'puzzle', type: 'puzzles', id: currentid}
  else if currenttype is 'rounds'
    base.push {page: 'round', type: 'rounds', id: currentid}
  else if currentpage isnt 'chat' and currentpage isnt 'blackboard'
    base.push {page: currentpage, type: currenttype, id: currentid}
  # If the new breadcrumbs are a prefix of the old ones, keep the old ones.
  if breadcrumbs? and base.length <= breadcrumbs.length
    return if do ->
      for crumb, i in base
        oldcrumb = breadcrumbs[i]
        if crumb.page isnt oldcrumb.page or crumb.type isnt oldcrumb.type or crumb.id isnt oldcrumb.id
          return false
      return true
  Session.set 'breadcrumbs', base

Template.header_breadcrumb_chat.helpers
  inThisRoom: ->
    return false unless Session.equals 'currentPage', 'chat'
    return false unless Session.equals 'type', @type
    Session.equals 'id', @id

active = ->
  (Session.equals('currentPage', @page) or Session.equals('currentPage', 'chat')) and \
  Session.equals('type', @type) and Session.equals('id', @id)

Template.header_breadcrumb_blackboard.helpers
  active: active

Template.header_breadcrumb_extra_links.helpers
  active: -> active.bind(Template.parentData(1))()

Template.header_breadcrumb_round.onCreated ->
  @autorun =>
    @subscribe 'round-by-id', Template.currentData().id
Template.header_breadcrumb_round.helpers
  round: -> model.Rounds.findOne @id if @id
  active: active

Template.header_breadcrumb_puzzle.onCreated ->
  @autorun =>
    @subscribe 'puzzle-by-id', Template.currentData().id
    @subscribe 'round-for-puzzle', Template.currentData().id
Template.header_breadcrumb_puzzle.helpers
  puzzle: -> model.Puzzles.findOne @id if @id
  active: active

Template.header_breadcrumb_quip.onCreated ->
  @autorun => @subscribe 'quips'
Template.header_breadcrumb_quip.helpers ->
  idIsNew: -> 'new' is @id
  quip: ->  model.Quips.findOne @id unless @id is 'new'

Template.header_breadcrumbs.helpers
  breadcrumbs: -> Session.get 'breadcrumbs'
  crumb_template: -> "header_breadcrumb_#{this.page}"
  active: active
  round: ->
    if Session.equals('type', 'puzzles')
      model.Rounds.findOne puzzles: Session.get("id")
    else if Session.equals('type', 'rounds')
      model.Rounds.findOne Session.get('id')
    else null
  puzzle: ->
    if Session.equals('type', 'puzzles')
      model.Puzzles.findOne Session.get('id')
    else null
  quip: ->
    if Session.equals('type', 'quips')
      model.Quips.findOne Session.get('id')
    else null
  type: -> Session.get('type')
  id: -> Session.get('id')
  idIsNew: -> Session.equals('id', 'new')
  picker: -> settings.PICKER_CLIENT_ID? and settings.PICKER_APP_ID? and settings.PICKER_DEVELOPER_KEY?
  drive: -> switch Session.get('type')
    when 'general'
      Session.get 'RINGHUNTERS_FOLDER'
    when 'rounds', 'puzzles'
      model.collection(Session.get('type'))?.findOne(Session.get('id'))?.drive

Template.header_breadcrumbs.events
  "mouseup .fake-link[data-href]": (event, template) ->
    # we work hard to try to make middle-click, shift-click, etc still work.
    a = $(event.currentTarget).closest('a')
    href = $(event.currentTarget).attr('data-href')
    oldhref = a.attr('href')
    a.attr('href', href)
    Meteor.setTimeout (-> a.attr('href', oldhref)), 100
  "click .bb-upload-file": (event, template) ->
    folder = switch Session.get('type')
      when 'general'
        Session.get 'RINGHUNTERS_FOLDER'
      when 'rounds', 'puzzles'
        model.collection(Session.get('type'))?.findOne(Session.get('id'))?.drive
    return unless folder
    uploadToDriveFolder folder, (docs) ->
      message = "uploaded "+(for doc in docs
        "<a href='#{doc.url}' target='_blank'><img src='#{doc.iconUrl}' />#{doc.name}</a> "
      ).join(', ')
      Meteor.call 'newMessage',
        body: message
        bodyIsHtml: true
        nick: reactiveLocalStorage.getItem 'nick'
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
Template.header_nickmodal.helpers
  nickModalVisible: -> Session.get 'nickModalVisible'

dismissable = ->
  return false if Session.equals 'currentPage', 'chat'
  return false is Session.equals 'currentPage', 'callins'
  not ((Session.equals 'currentPage', 'blackboard') and Session.get 'canEdit')

Template.header_nickmodal.onCreated ->
  @autorun ->
    hasNick = (reactiveLocalStorage.getItem 'nick')?
    if hasNick
      $('#nickPickModal').modal 'hide'
    else if not dismissable() and not Session.equals 'nickModalVisible', true
      Session.set 'nickModalVisible', true

Template.header_nickmodal_contents.helpers
  dismissable: dismissable
Template.header_nickmodal_contents.onCreated ->
  # we'd need to subscribe to 'all-nicks' here if we didn't have a permanent
  # subscription to it (in main.coffee)
  this.typeaheadSource = (query,process) =>
    this.update(query)
    (n.name for n in model.Nicks.find({}).fetch())
  this.update = (query, options) =>
    # can we find an existing nick matching this?
    n = if query \
        then model.Nicks.findOne canon: model.canonical(query) \
        else undefined
    if (n or options?.force)
      realname = model.getTag n, 'Real Name'
      gravatar = model.getTag n, 'Gravatar'
      $('#nickRealname').val(realname or '')
      $('#nickEmail').val(gravatar or '')
    this.updateGravatar()
  this.updateGravatar = () =>
    email = $('#nickEmail').val() or "#{model.canonical($('#nickInput').val())}@#{settings.DEFAULT_HOST}"
    gravatar = $.gravatar email,
      image: 'wavatar' # 'monsterid'
      classes: 'img-polaroid'
      secure: true
    container = $(this.find('.gravatar'))
    if container.find('img').length
      container.find('img').attr('src', gravatar.attr('src'))
    else
      container.append(gravatar)
Template.header_nickmodal_contents.onRendered ->
  $('#nickPickModal').one 'hide', ->
    Session.set 'nickModalVisible', undefined
  $('#nickSuccess').val('false')
  $('#nickPickModal').modal keyboard: false, backdrop:"static"
  $('#nickInput').select()
  firstNick = (reactiveLocalStorage.getItem 'nick') or ''
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

$(document).on 'submit', '#nickPick', ->
  $warningGroup = $(this).find '#nickInputGroup'
  $warning = $(this).find "#nickInputGroup .help-inline"
  nick = $("#nickInput").val().replace(/^\s+|\s+$/g,"") #trim
  $warning.html ""
  $warningGroup.removeClass('error')
  if not nick || nick.length > 20
    $warning.html("Nickname must be between 1 and 20 characters long!")
    $warningGroup.addClass('error')
  else
    reactiveLocalStorage.setItem 'nick', nick
    realname = $('#nickRealname').val()
    gravatar = $('#nickEmail').val()
    Meteor.call 'newNick', {name: nick}, (error,n) ->
      tagsetter = (value, tagname, cb=(->)) ->
        value = value.replace(/^\s+|\s+$/g,"") # strip
        if model.getTag(n, tagname) is value
          cb()
        else
          Meteor.call 'setTag', {type:'nicks', object:n._id, name:tagname, value:value, who:n.canon}, ->
            cb()
      tagsetter realname, 'Real Name', ->
        tagsetter gravatar, 'Gravatar'
    $('#nickSuccess').val('true')
    $('#nickPickModal').modal 'hide'

  share.chat.hideMessageAlert()
  return false

changeNick = (cb) ->
  $('#nickPickModal').one 'hide', ->
    cb?() if $('#nickSuccess').val() is 'true'
  Session.set 'nickModalVisible', true

ensureNick = share.ensureNick = (cb=(->)) ->
  if reactiveLocalStorage.getItem 'nick'
    cb()
  else
    changeNick cb

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

############## operation log in header ####################
Template.header_lastupdates.helpers
  lastupdates: ->
    LIMIT = 10
    ologs = model.Messages.find {room_name: "oplog/0"}, \
          {sort: [["timestamp","desc"]], limit: LIMIT}
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
    p = share.chat.pageForTimestamp 'oplog/0', 0, {subscribe:this}
    return unless p? # wait until page info is loaded
    messages = if p.archived then "oldmessages" else "messages"
    this.subscribe "#{messages}-in-range", p.room_name, p.from, p.to
# add tooltip to 'more' links
do ->
  for t in ['header_lastupdates', 'header_lastchats']
    Template[t].onRendered ->
      $(this.findAll('.right a[title]')).tooltip placement: 'left'

############## chat log in header ####################
Template.header_lastchats.helpers
  lastchats: ->
    LIMIT = 2
    m = model.Messages.find {
      room_name: "general/0", system: false, bodyIsHtml: false
    }, {sort: [["timestamp","desc"]], limit: LIMIT}
    m = m.fetch().reverse()
    return m
  msgbody: ->
    if this.bodyIsHtml then new Spacebars.SafeString(this.body) else this.body

# subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastchats.onCreated ->
  return if settings.BB_DISABLE_RINGHUNTERS_HEADER
  this.autorun =>
    p = share.chat.pageForTimestamp 'general/0', 0, {subscribe:this}
    return unless p? # wait until page info is loaded
    messages = if p.archived then "oldmessages" else "messages"
    # use autorun to ensure subscription changes if/when nick does
    nick = (reactiveLocalStorage.getItem 'nick') or null
    if nick? and not settings.BB_DISABLE_PM
      this.subscribe "#{messages}-in-range-nick", nick, p.room_name, p.from, p.to
    this.subscribe "#{messages}-in-range", p.room_name, p.from, p.to
