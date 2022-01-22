'use strict'

import {gravatarUrl, nickHash, nickAndName} from '/client/imports/nickEmail.coffee'

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
    Meteor.users.find({}, {fields: {nickname: 1, real_name: 1, gravatar_md5: 1, located_at: 1}}).observeChanges
      added: (_id, fields) =>
        user = new google.maps.Marker
          position: @mapsImport.positionOrDefault fields.located_at, _id
          icon: gravatarUrl(gravatar_md5: nickHash(_id), size: 64)
          title: nickAndName fields
        users.set _id, user
        clusterer.addMarker user
      changed: (id, fields) =>
        {gravatar_md5, located_at, real_name} = fields
        user = users.get id
        if 'located_at' in fields  # if set, even to undefined
          user.setPosition @mapsImport.positionOrDefault(located_at, id)
        if 'gravatar_md5' in fields
          user.setIcon gravatarUrl(gravatar_md5: nickHash(id), size: 64)
        if 'real_name' in fields or 'nickname' in fields
          # Other might not be set, so have to fetch whole user document
          user.setTitle nickAndName Meteor.users.findOne(id)
      removed: (id) ->
        clusterer.removeMarker users.get id
        users.delete id
