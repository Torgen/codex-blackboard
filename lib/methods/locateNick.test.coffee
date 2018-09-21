'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
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

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'locateNick',
        lat: 37.368832
        lng: -122.036346
        timestamp: 5
    , Match.Error

  describe 'without queue position', ->
    id = null
    beforeEach ->
      id = Meteor.users.insert
        _id: 'torgen'
        located_at:  # Mountain View, CA
          lat: 37.419857
          lng: -122.078827
    
      Meteor.callAs 'locateNick', 'torgen',
        # Sunnyvale, CA
        lat: 37.368832
        lng: -122.036346
        timestamp: 5

    it 'leaves public location', ->
      chai.assert.deepInclude Meteor.users.findOne(id),
        located_at:
          lat: 37.419857
          lng: -122.078827

    it 'sets private location fields', ->
      chai.assert.deepInclude Meteor.users.findOne(id),
        priv_located: 5
        priv_located_at:
          lat: 37.368832
          lng: -122.036346
        priv_located_order: 7

  it 'leaves existing queue position', ->
    id = Meteor.users.insert
      _id: 'torgen'
      located_at:  # Mountain View, CA
        lat: 37.419857
        lng: -122.078827
      priv_located_order: 4
  
    Meteor.callAs 'locateNick', 'torgen',
      # Sunnyvale, CA
      lat: 37.368832
      lng: -122.036346

    chai.assert.deepInclude Meteor.users.findOne(id),
      priv_located: 7
      priv_located_order: 4

    
