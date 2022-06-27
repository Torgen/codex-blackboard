import './map.html'
import './cluster.html'
import {gravatarUrl, nickHash, nickAndName} from '/client/imports/nickEmail.coffee'
import {Loader} from "@googlemaps/js-api-loader"
import {MarkerClusterer} from "@googlemaps/markerclusterer"
import {MarkerWithLabel} from "@googlemaps/markerwithlabel"
import md5 from 'md5'
import {positionOrDefault, solarLongitude} from './geography.coffee'

loaded = new ReactiveVar false
do ->
  loader = new Loader
    apiKey: share.settings.MAPS_API_KEY
    version: 'weekly'
  await loader.load()
  loaded.set true
  
Template.map.onCreated ->
  @map = new ReactiveVar null

MAX_CIRCLES = 5
GRAVATAR_SIZE = 64

class BlackboardRenderer
  constructor: ->
    @markersAndViews = []
  render: ({markers, position}, stats) ->
    console.log markers
    numOnline = 0
    numOffline = 0
    markers = markers.slice(0)
    markers.sort((a, b) -> b.getOpacity() - a.getOpacity())  # Online first, then offline
    for marker in markers
      if marker.getOpacity() is 1.0
        numOnline++
      else
        numOffline++
    [fullOnline, fullOffline, summaryOnline, summaryOffline] = [0, 0, 0, 0]
    if numOnline + numOffline <= MAX_CIRCLES
      [fullOnline, fullOffline] = [numOnline, numOffline]
    else if numOffline is 0
      [fullOnline, summaryOnline] = [4, numOnline - 4]
    else if numOnline is 0
      [fullOffline, summaryOffline] = [4, numOffline - 4]
    else if numOnline is 1
      [fullOnline, fullOffline, summaryOffline] = [1, 3, numOffline - 3]
    else if numOffline is 1
      [fullOnline, summaryOnline, fullOffline] = [3, numOnline - 3, 1]
    else
      [fullOnline, summaryOnline, summaryOffline] = [3, numOnline - 3, numOffline]
    pieces = for marker in markers
      piece = null
      if (marker.getOpacity() is 1.0 and fullOnline > 0 and fullOnline--) or (marker.getOpacity() < 1.0 and fullOffline > 0 and fullOffline--)
        piece = {gravatar: marker.getIcon(), title: marker.getTitle(), onlineness: (if marker.getOpacity() is 1.0 then 'online' else 'offline')}
      else if marker.getOpacity() is 1.0 and summaryOnline > 0
        piece = {summary: summaryOnline, title: "#{summaryOnline} more online", onlineness: 'online'}
        summaryOnline = 0
      else if marker.getOpacity() < 1.0 and summaryOffline > 0
        piece = {summary: summaryOffline, title: "#{summaryOffline} more offline", onlineness: 'offline'}
        summaryOffline = 0
      else continue
      piece
    element = document.createElement('div')
    # We render the pieces in reverse order so the last one is on top, so the title attributes trigger in the intuitive way.
    view = Blaze.renderWithData(Template.map_gravatar_cluster, pieces.reverse(), element)
    marker = new MarkerWithLabel {position, icon: {url: 'https://maps.gstatic.com/mapfiles/transparent.png', size: new google.maps.Size(0, 0)}, labelContent: element, labelAnchor: new google.maps.Point(-32, -32)}
    @markersAndViews.push {marker, view} # So we can clean up the views after rendering.
    return marker
    
Template.map.onRendered ->
  @autorun =>
    return unless loaded.get()
    map = new google.maps.Map @$('.bb-solver-map')[0],
      center:
        lat: 15
        lng: -71.1
      zoom: 3
      mapTypeControlOptions:
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR
        position: google.maps.ControlPosition.TOP_CENTER
    @map.set map
    renderer = new BlackboardRenderer
    clusterer = new MarkerClusterer {map, renderer}
    oldMarkersAndViews = null
    google.maps.event.addListener clusterer, 'clusteringbegin', ->
      oldMarkersAndViews = renderer.markersAndViews
      renderer.markersAndViews = []
    google.maps.event.addListener clusterer, 'clusteringend', ->
      for markerAndView in oldMarkersAndViews
        if markerAndView.marker.getMap()?
          renderer.markersAndViews.push markerAndView
        else
          Blaze.remove markerAndView.view
    users = new Map() # the associative kind
    nodraw = true
    Meteor.users.find({}, {fields: {nickname: 1, real_name: 1, gravatar_md5: 1, located_at: 1, online: 1}}).observeChanges
      added: (_id, fields) =>
        Tracker.nonreactive =>
          user = new google.maps.Marker
            position: positionOrDefault fields.located_at, _id
            icon: gravatarUrl(gravatar_md5: nickHash(_id), size: GRAVATAR_SIZE)
            title: nickAndName fields
            opacity: if fields.online then 1.0 else 0.5
          users.set _id, user
          clusterer.addMarker user, nodraw
      changed: (id, fields) =>
        console.log fields
        Tracker.nonreactive =>
          {gravatar_md5, located_at, real_name} = fields
          user = users.get id
          if 'located_at' of fields  # if set, even to undefined
            user.setPosition positionOrDefault(located_at, id)
          if 'gravatar_md5' of fields
            user.setIcon gravatarUrl(gravatar_md5: nickHash(id), size: GRAVATAR_SIZE)
          if 'real_name' of fields or 'nickname' of fields
            # Other might not be set, so have to fetch whole user document
            user.setTitle nickAndName Meteor.users.findOne(id)
          if 'online' of fields
            user.setOpacity(if fields.online then 1.0 else 0.5)
          clusterer.removeMarker user
          clusterer.addMarker user
      removed: (id) ->
        clusterer.removeMarker users.get id
        users.delete id
    nodraw = false
    clusterer.render()
  @autorun =>
    return unless Template.currentData().followTheSun
    map = @map.get()
    return unless map?
    map.setCenter
      lat: 15
      lng: solarLongitude Session.get 'currentTime'
    map.setZoom 3
