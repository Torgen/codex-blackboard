'use strict'

import {gravatarUrl, hashFromNickObject} from '/client/imports/nickEmail.coffee'

Template.map.onCreated ->
  @loaded = new ReactiveVar false
  @mapsImport = await import('/client/imports/map.coffee')
  loader = new @mapsImport.Loader
    apiKey: share.settings.MAPS_API_KEY
    version: 'weekly'
  await loader.load()
  @loaded.set true

Template.map.onRendered ->
  @autorun =>
    return unless @loaded.get()
    map = new google.maps.Map @$('.bb-solver-map')[0],
      center:
        lat: 10
        lng: -71.1
      zoom: 2
    clusterer = new @mapsImport.MarkerClusterer {map}
    users = new Map()
    Meteor.users.find({}, {fields: {gravatar_md5: 1, located_at: 1}}).observeChanges
      added: (_id, {gravatar_md5, located_at}) ->
        user = new google.maps.Marker
          position: @mapsImport.positionOrDefault located_at, _id
          icon: gravatarUrl(gravatar_md5: hashFromNickObject({_id, gravatar_md5}), size: 64)
        users.set _id, user
        clusterer.addMarker user
      changed: (id, {located_at}) ->
        if located_at?
          user = users.get id
          user.setPosition @mapsImport.positionOrDefault(located_at, id)
      removed: (id) ->
        clusterer.removeMarker users.get id
        users.delete id
