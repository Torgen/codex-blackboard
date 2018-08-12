'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'locateNick', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'without queue position', ->
    id = null
    beforeEach ->
      id = model.Nicks.insert
        name: 'Torgen'
        canon: 'torgen'
        located_at:  # Mountain View, CA
          lat: 37.419857
          lng: -122.078827
    
      Meteor.call 'locateNick',
        nick: 'Torgen'
        # Sunnyvale, CA
        lat: 37.368832
        lng: -122.036346
        timestamp: 5

    it 'leaves public location', ->
      chai.assert.deepInclude model.Nicks.findOne(id),
        located_at:
          lat: 37.419857
          lng: -122.078827

    it 'sets private location fields', ->
      chai.assert.deepInclude model.Nicks.findOne(id),
        priv_located: 5
        priv_located_at:
          lat: 37.368832
          lng: -122.036346
        priv_located_order: 7

  it 'leaves existing queue position', ->
    id = model.Nicks.insert
      name: 'Torgen'
      canon: 'torgen'
      located_at:  # Mountain View, CA
        lat: 37.419857
        lng: -122.078827
      priv_located_order: 4
  
    Meteor.call 'locateNick',
      nick: 'Torgen'
      # Sunnyvale, CA
      lat: 37.368832
      lng: -122.036346

    chai.assert.deepInclude model.Nicks.findOne(id),
      priv_located: 7
      priv_located_order: 4

    
