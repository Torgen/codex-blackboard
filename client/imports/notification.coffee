
import { reactiveLocalStorage } from '/client/imports/storage.coffee'

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
  'new-puzzles': false
  stuck: false
  'favorite-mechanics': true
  'private-messages': true

export streams = [
  {name: 'new-puzzles', label: 'New Puzzles'}
  {name: 'announcements', label: 'Announcements'}
  {name: 'callins', label: "Call-Ins"}
  {name: 'answers', label: "Answers"}
  {name: 'stuck', label: 'Stuck Puzzles'}
  {name: 'favorite-mechanics', label: 'Favorite Mechanics'}
  {name: 'private-messages', label: 'Private Messages/Mentions'}
]

countDependency = new Tracker.Dependency

export count = ->
  countDependency.depend()
  i = 0
  for stream, def of notificationDefaults
    if reactiveLocalStorage.getItem(keystring stream) is "true"
      i += 1
  return i

export set = (k, v) ->
  ks = keystring k
  v = notificationDefaults[k] if v is undefined
  was = reactiveLocalStorage.getItem ks
  reactiveLocalStorage.setItem ks, v
  if was isnt v
    countDependency.changed()

export get = (k) ->
  ks = keystring k
  v = reactiveLocalStorage.getItem ks
  return unless v?
  v is "true"

export granted = -> Session.equals 'notifications', 'granted'

export shouldAsk = ->
  return false unless Notification?
  p = Session.get 'notifications'
  p isnt 'granted' and p isnt 'denied'

export ask = ->
  Notification.requestPermission (ok) ->
    Session.set 'notifications', ok
    setupNotifications() if ok is 'granted'

# On android chrome, we clobber this with a version that uses the
# ServiceWorkerRegistration.
export notify = (title, settings) ->
  try
    n = new Notification title, settings
    if settings.data?.url?
      n.onclick = ->
        share.Router.navigate settings.data.url, trigger: true
        window.focus()
  catch err
    console.log err.message
    throw err

setupNotifications = ->
  if isAndroidChrome()
    navigator.serviceWorker.register(Meteor._relativeToSiteRootUrl 'sw.js').then((reg) ->
      navigator.serviceWorker.addEventListener 'message', (msg) ->
        console.log msg.data unless Meteor.isProduction
        return unless msg.data.action is 'navigate'
        share.Router.navigate msg.data.url, trigger: true
      notify = (title, settings) -> reg.showNotification title, settings
      finishSetupNotifications()
    ).catch (error) -> Session.set 'notifications', 'default'
    return
  finishSetupNotifications()

finishSetupNotifications = ->
  for stream, def of notificationDefaults
    set(stream, def) unless get(stream)?
  
Meteor.startup ->
  # Prep notifications
  unless Notification?
    Session.set 'notifications', 'denied'
    return
  Session.set 'notifications', Notification.permission
  setupNotifications() if Notification.permission is 'granted'