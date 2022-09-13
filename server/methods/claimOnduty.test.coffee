'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs, impersonating } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import { RoleRenewalTime } from '/lib/imports/settings.coffee'

model = share.model

describe 'claimOnduty', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    RoleRenewalTime.ensure()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'claimOnduty', from: 'cjb'
    , Match.Error

  describe 'when nobody is onduty', ->
    it 'claims onduty from nobody', ->
      callAs 'claimOnduty', 'torgen', from: null
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'torgen'
        claimed_at: 7
        renewed_at: 7
        expires_at: 3600007
      o = model.Messages.find(room_name: 'oplog/0').fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        type: 'roles'
        id: 'onduty'
        stream: 'onduty'
        nick: 'torgen'
        body: 'is now'

    it 'claims onduty from anybody', ->
      callAs 'claimOnduty', 'torgen', from: 'cscott'
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'torgen'
        claimed_at: 7
        renewed_at: 7
        expires_at: 3600007
      o = model.Messages.find(room_name: 'oplog/0').fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        type: 'roles'
        id: 'onduty'
        stream: 'onduty'
        nick: 'torgen'
        body: 'is now'

    it 'uses setting for renewal time', ->
      impersonating 'cjb', -> RoleRenewalTime.set 30
      callAs 'claimOnduty', 'torgen', from: 'cscott'
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'torgen'
        claimed_at: 7
        renewed_at: 7
        expires_at: 1800007

  describe 'when somebody is onduty', ->
    beforeEach ->
      model.Roles.insert
        _id: 'onduty'
        holder: 'cjb'
        claimed_at: 1
        renewed_at: 1
        expires_at: 3600001

    it 'claims onduty from them', ->
      callAs 'claimOnduty', 'torgen', from: 'cjb'
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'torgen'
        claimed_at: 7
        renewed_at: 7
        expires_at: 3600007
      o = model.Messages.find(room_name: 'oplog/0').fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        type: 'roles'
        id: 'onduty'
        stream: 'onduty'
        nick: 'torgen'
        body: 'took over from @cjb as'

    it 'fails to claim onduty from somebody else', ->
      chai.assert.throws ->
        callAs 'claimOnduty', 'torgen', from: 'cscott'
      , Meteor.Error, /412/
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'cjb'
        claimed_at: 1
        renewed_at: 1
        expires_at: 3600001

    it 'fails to claim onduty from nobody', ->
      chai.assert.throws ->
        callAs 'claimOnduty', 'torgen', from: null 
      , Meteor.Error, /412/
      chai.assert.deepInclude model.Roles.findOne('onduty'),
        holder: 'cjb'
        claimed_at: 1
        renewed_at: 1
        expires_at: 3600001
