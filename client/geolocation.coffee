'use strict'

import canonical from '../lib/imports/canonical.coffee'

model = share.model # import
settings = share.settings # import

# Geolocation-related utilities

GEOLOCATION_DISTANCE_THRESHOLD = 10/5280 # 10 feet
GEOLOCATION_NEAR_DISTANCE = 1 # folks within a mile of you are "near"

deg2rad = (deg) ->
  deg * Math.PI / 180

lng = (geojson) -> geojson.coordinates[0]
lat = (geojson) -> geojson.coordinates[1]

distance = (one, two) ->
  [lat1,lon1,lat2,lon2] = [lat(one),lng(one),lat(two),lng(two)]
  R = 6371.009 # Radius of the earth in km
  Rmi = 3958.761 # Radius of the earth in miles
  dLat = deg2rad(lat2 - lat1) # deg2rad below
  dLon = deg2rad(lon2 - lon1)
  a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  d = Rmi * c # Distance in miles
  return d

updateLocation = do ->
  last = null
  (pos) ->
    return unless pos?
    if last?
      return if lat(pos) == lat(last) and lng(pos) == lng(last)
      return if distance(last, pos) < GEOLOCATION_DISTANCE_THRESHOLD
    last = pos
    Tracker.nonreactive ->
      Meteor.call 'locateNick', location: pos

# As long as the user is logged in, stream position updates to server
Tracker.autorun ->
  return if settings.DISABLE_GEOLOCATION
  Geolocation.setPaused !share.isVisible()
  nick = Meteor.userId()
  return unless nick?
  pos = Geolocation.latLng(enableHighAccuracy:false)
  return unless pos?
  geojson =
    type: 'Point'
    coordinates: [pos.lng, pos.lat]
  Session.set "position", geojson # always use most current location client-side
  updateLocation geojson

distanceTo = (nick) ->
  return null unless nick
  p = Session.get 'position'
  return null unless p?
  n = Meteor.users.findOne canonical nick
  return null unless n? and n.located_at?
  return distance(n.located_at, p)

isNickNear = share.isNickNear = (nick) ->
  return true if canonical(nick) is Meteor.userId() # that's me!
  dist = distanceTo(nick)
  return false unless dist?
  return dist <= GEOLOCATION_NEAR_DISTANCE

Template.registerHelper 'nickNear', (args) ->
  args = share.keyword_or_positional 'nick', args
  isNickNear args.nick

CODEXBOT_LOCATIONS = [
  'inside your computer'
  'hanging around'
  'solving puzzles'
  'not amused'
  'having fun!'
  "Your Plastic Pal Who's Fun to Be With."
  'fond of memes'
  'waiting for you humans to find the coin already'
  'muttering about his precious'
]

Template.registerHelper 'nickLocation', (args) ->
  args = share.keyword_or_positional 'nick', args
  return '' if canonical(args.nick) is Meteor.userId() # that's me!
  if args.nick is 'codexbot'
    idx = Math.floor(Session.get('currentTime') / (10*60*1000))
    return " is #{CODEXBOT_LOCATIONS[idx%CODEXBOT_LOCATIONS.length]}"
  d = distanceTo(args.nick)
  return '' unless d?
  feet = d * 5280
  return switch
    when d > 5 then " is #{d.toFixed(0)} miles from you"
    when d > 0.1 then " is #{d.toFixed(1)} miles from you"
    when feet > 5 then " is #{feet.toFixed(0)} feet from you"
    when feet > 0.5 then " is #{feet.toFixed(1)} feet from you"
    else " is, perhaps, on your lap?"
