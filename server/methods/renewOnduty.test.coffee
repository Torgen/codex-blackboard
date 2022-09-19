'use strict'

# For side effects
import '/lib/model.coffee'
import { Roles } from '/lib/imports/collections.coffee'
import { callAs, impersonating } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import { RoleRenewalTime } from '/lib/imports/settings.coffee'

describe 'renewOnduty', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 70000
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    RoleRenewalTime.ensure()
  
  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'renewOnduty'
    , Match.Error

  it 'renews your onduty', ->
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: 10
      renewed_at: 10
      expires_at: 3600010
    chai.assert.isTrue callAs 'renewOnduty', 'torgen'
    chai.assert.deepInclude Roles.findOne('onduty'),
      holder: 'torgen'
      claimed_at: 10
      renewed_at: 70000
      expires_at: 3670000

  it 'uses renewal time', ->
    impersonating 'cjb', -> RoleRenewalTime.set 30
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: 10
      renewed_at: 10
      expires_at: 3600010
    chai.assert.isTrue callAs 'renewOnduty', 'torgen'
    chai.assert.deepInclude Roles.findOne('onduty'),
      holder: 'torgen'
      claimed_at: 10
      renewed_at: 70000
      expires_at: 1870000

  it 'fails when nobody is onduty', ->
    chai.assert.isFalse callAs 'renewOnduty', 'torgen'
    chai.assert.isNotOk  Roles.findOne('onduty')

  it 'fails when somebody else is onduty', ->
    Roles.insert
      _id: 'onduty'
      holder: 'cscott'
      claimed_at: 10
      renewed_at: 10
      expires_at: 3600010
    chai.assert.isFalse callAs 'renewOnduty', 'torgen'
    chai.assert.deepInclude Roles.findOne('onduty'),
      holder: 'cscott'
      claimed_at: 10
      renewed_at: 10
      expires_at: 3600010
