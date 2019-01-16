'use strict'

import { nickEmail } from './imports/nickEmail.coffee'
import abbrev from '../lib/imports/abbrev.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import embeddable from './imports/embeddable.coffee'

settings = share.settings # import
model = share.model
chat = share.chat # import

# "Top level" templates:
#   "blackboard" -- main blackboard page
#   "puzzle"     -- puzzle information page
#   "round"      -- round information (much like the puzzle page)
#   "chat"       -- chat room
#   "oplogs"     -- operation logs
#   "callins"    -- answer queue
#   "quips"      -- view/edit phone-answering quips
#   "facts"      -- server performance information
Template.registerHelper "equal", (a, b) -> a is b

# session variables we want to make available from all templates
do -> for v in ['currentPage']
  Template.registerHelper v, () -> Session.get(v)
Template.registerHelper 'abbrev', abbrev
Template.registerHelper 'currentPageEquals', (arg) ->
  # register a more precise dependency on the value of currentPage
  Session.equals 'currentPage', arg
Template.registerHelper 'typeEquals', (arg) ->
  # register a more precise dependency on the value of type
  Session.equals 'type', arg
Template.registerHelper 'canEdit', () ->
  Meteor.userId() and (Session.get 'canEdit') and \
  (Session.equals 'currentPage', 'blackboard')
Template.registerHelper 'editing', (args..., options) ->
  canEdit = options?.hash?.canEdit or (Session.get 'canEdit')
  return false unless Meteor.userId() and canEdit
  return Session.equals 'editing', args.join('/')

Template.registerHelper 'linkify', (contents) ->
  contents = chat.convertURLsToLinksAndImages(UI._escape(contents))
  return new Spacebars.SafeString(contents)

Template.registerHelper 'compactHeader', () ->
  (Session.equals 'currentPage', 'chat')

Template.registerHelper 'teamName', -> settings.TEAM_NAME

Template.registerHelper 'mynick', -> Meteor.user()?.nickname

Template.registerHelper 'boringMode', -> 'true' is reactiveLocalStorage.getItem 'boringMode'

Template.registerHelper 'embeddable', embeddable

# subscribe to the dynamic settings all the time.
Meteor.subscribe 'settings'
# subscribe to the all-names feed all the time
Meteor.subscribe 'all-names'
# subscribe to all nicks all the time
Meteor.subscribe 'all-nicks'
# we might subscribe to all-roundsandpuzzles, too.
if settings.BB_SUB_ALL
  Meteor.subscribe 'all-roundsandpuzzles'
# we also always subscribe to the last-pages feed; see chat.coffee

keystring = (k) -> "notification.stream.#{k}"

# Chrome for Android only lets you use Notifications via
# ServiceWorkerRegistration, not directly with the Notification class.
# It appears no other browser (that isn't derived from Chrome) is like that.
# Since there's no capability to detect, we have to use user agent.
isAndroidChrome = -> /Android.*Chrome\/[.0-9]*/.test(navigator.userAgent)

notificationDefaults =
  callins: false
  answers: true
  announcements: true
  'new-puzzles': true
  stuck: false

countDependency = new Tracker.Dependency

share.notification =
  count: () ->
    countDependency.depend()
    i = 0
    for stream, def of notificationDefaults
      if reactiveLocalStorage.getItem(keystring stream) is "true"
        i += 1
    return i
  set: (k, v) ->
    ks = keystring k
    v = notificationDefaults[k] if v is undefined
    was = reactiveLocalStorage.getItem ks
    reactiveLocalStorage.setItem ks, v
    if was isnt v
      countDependency.changed()
  get: (k) ->
    ks = keystring k
    v = reactiveLocalStorage.getItem ks
    return unless v?
    v is "true"
  # On android chrome, we clobber this with a version that uses the
  # ServiceWorkerRegistration.
  notify: (title, settings) ->
    new Notification title, settings
  ask: ->
    Notification.requestPermission (ok) ->
      Session.set 'notifications', ok
      setupNotifications() if ok is 'granted'
setupNotifications = ->
  if isAndroidChrome()
    navigator.serviceWorker.register(Meteor._relativeToSiteRootUrl 'empty.js').then((reg) ->
      share.notification.notify = (title, settings) ->
        reg.showNotification title, settings
      finishSetupNotifications()
    ).catch (error) -> Session.set 'notifications', 'default'
    return
  finishSetupNotifications()

finishSetupNotifications = ->
  for stream, def of notificationDefaults
    share.notification.set(stream, def) unless share.notification.get(stream)?

Meteor.startup ->
  now = share.model.UTCNow() + 3
  suppress = true
  Tracker.autorun ->
    return if share.notification.count() is 0 # unsubscribes
    p = share.chat.pageForTimestamp 'oplog/0', 0, {subscribe:true}
    return unless p? # wait until page info is loaded
    messages = if p.archived then "oldmessages" else "messages"
    Meteor.subscribe "#{messages}-in-range", p.room_name, p.from, p.to,
      onStop: -> suppress = true
      onReady: -> suppress = false
  share.model.Messages.find({room_name: 'oplog/0', timestamp: $gte: now}).observeChanges
    added: (id, msg) ->
      return unless Notification?.permission is 'granted'
      return unless share.notification.get(msg.stream)
      return if suppress
      gravatar = $.gravatar nickEmail(msg.nick),
        image: 'wavatar'
        size: 192
        secure: true
      body = msg.body
      if msg.type and msg.id
        body = "#{body} #{share.model.pretty_collection(msg.type)}
                #{share.model.collection(msg.type).findOne(msg.id)?.name}"
      share.notification.notify msg.nick,
        body: body
        tag: id
        icon: gravatar[0].src
  unless Notification?
    Session.set 'notifications', 'denied'
    return
  Session.set 'notifications', Notification.permission
  setupNotifications() if Notification.permission is 'granted'

distToTop = (x) -> Math.abs(x.getBoundingClientRect().top - 110)

closestToTop = ->
  return unless Session.equals 'currentPage', 'blackboard'
  nearTop = $('#bb-tables')[0]
  return unless nearTop
  minDist = distToTop nearTop
  $('#bb-tables table [id]').each (i, e) ->
    dist = distToTop e
    if dist < minDist
      nearTop = e
      minDist = dist
  nearTop

scrollAfter = (x) ->
  nearTop = closestToTop()
  offset = nearTop?.getBoundingClientRect().top
  x()
  if nearTop?
    Tracker.afterFlush ->
      $.scrollTo "##{nearTop.id}",
        duration: 100
        offset: {top: -offset}

# Router
BlackboardRouter = Backbone.Router.extend
  routes:
    "": "BlackboardPage"
    "edit": "EditPage"
    "rounds/:round": "RoundPage"
    "puzzles/:puzzle": "PuzzlePage"
    "puzzles/:puzzle/:view": "PuzzlePage"
    "chat/:type/:id": "ChatPage"
    "chat/:type/:id/:timestamp": "ChatPage"
    "oplogs/:timestamp": "OpLogPage"
    "callins": "CallInPage"
    "quips/:id": "QuipPage"
    "facts": "FactsPage"
    "loadtest/:which": "LoadTestPage"

  BlackboardPage: ->
    scrollAfter =>
      this.Page("blackboard", "general", "0")
      Session.set
        canEdit: undefined
        editing: undefined

  EditPage: ->
    scrollAfter =>
      this.Page("blackboard", "general", "0")
      Session.set
        canEdit: true
        editing: undefined

  PuzzlePage: (id, view=null) ->
    this.Page("puzzle", "puzzles", id)
    Session.set
      timestamp: 0
      view: view

  RoundPage: (id) ->
    this.goToChat "rounds", id, 0

  ChatPage: (type,id,timestamp=0) ->
    id = "0" if type is "general"
    this.Page("chat", type, id)
    Session.set "timestamp", +timestamp

  OpLogPage: (timestamp) ->
    this.Page("oplog", "oplog", "0")
    Session.set "timestamp", timestamp

  CallInPage: ->
    this.Page("callins", "callins", "0")

  QuipPage: (id) ->
    this.Page("quip", "quips", id)

  FactsPage: ->
    this.Page("facts", "facts", "0")

  LoadTestPage: (which) ->
    return if Meteor.isProduction
    # redirect to one of the 'real' pages, so that client has the
    # proper subscriptions, etc; plus launch a background process
    # to perform database mutations
    cb = (args) =>
      {page,type,id,timestamp} = args
      url = switch page
        when 'chat' then this.chatUrlFor type, id, timestamp
        when 'oplogs' then this.urlFor 'oplogs', timestamp # bit of a hack
        when 'blackboard' then Meteor._relativeToSiteRootUrl "/"
        when 'facts' then this.urlFor 'facts', '' # bit of a hack
        else this.urlFor type, id
      this.navigate(url, {trigger:true})
    r = share.loadtest.start which, cb
    cb(r) if r? # immediately navigate if method is synchronous

  Page: (page, type, id) ->
    Session.set
      currentPage: page
      type: type
      id: id
      room_name: (type+'/'+id)
    # cancel modals if they were active
    $('#nickPickModal').modal 'hide'
    $('#confirmModal').modal 'hide'

  urlFor: (type,id) ->
    Meteor._relativeToSiteRootUrl "/#{type}/#{id}"
  chatUrlFor: (type, id, timestamp) ->
    (Meteor._relativeToSiteRootUrl "/chat#{this.urlFor(type,id)}") + \
    (if (+timestamp) then "/#{+timestamp}" else "")

  goTo: (type,id) ->
    this.navigate(this.urlFor(type,id), {trigger:true})

  goToRound: (round) -> this.goTo("rounds", round._id)

  goToPuzzle: (puzzle) ->  this.goTo("puzzles", puzzle._id)

  goToChat: (type, id, timestamp) ->
    this.navigate(this.chatUrlFor(type, id, timestamp), {trigger:true})

share.Router = new BlackboardRouter()
Backbone.history.start {pushState: true}
