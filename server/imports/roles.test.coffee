'use strict'


# For side effects
import '/lib/model.coffee'
import { Roles } from '/lib/imports/collections.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import delay from 'delay'
import { waitForDeletion, waitForDocument } from '/lib/imports/testutils.coffee'
import { RoleManager } from './roles.coffee'

describe 'RoleManager', ->
  clock = null
  manager = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 7
      toFake: ["setTimeout", "clearTimeout", "Date"]

  afterEach ->
    manager?.stop()
    clock.restore()

  it 'deletes expired immediately', ->
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: -3600000
      renewed_at: -3600000
      expires_at: 0
    manager = new RoleManager
    manager.start()
    chai.assert.isNotOk Roles.findOne('onduty')

  it 'deletes expired after expiry', ->
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: -3599000
      renewed_at: -3599000
      expires_at: 1000
    manager = new RoleManager
    manager.start()
    chai.assert.isOk Roles.findOne('onduty')
    p = waitForDeletion Roles, 'onduty'
    clock.tick(1000)
    await p

  it 'extends deadline after update', ->
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: -3599000
      renewed_at: -3599000
      expires_at: 1000
    manager = new RoleManager
    manager.start()
    chai.assert.isOk Roles.findOne('onduty')
    Roles.update 'onduty',
      holder: 'cjb'
      expires_at: 2000
    clock.tick(1000)
    # check not deleted?
    await waitForDocument Roles, {_id: 'onduty', expires_at: 2000}, {}
    p = waitForDeletion Roles, 'onduty'
    clock.tick(1000)
    await p

  it 'cancels timeout after removal', ->
    Roles.insert
      _id: 'onduty'
      holder: 'torgen'
      claimed_at: -3599000
      renewed_at: -3599000
      expires_at: 1000
    p = waitForDeletion Roles, 'onduty'
    manager = new RoleManager
    manager.start()
    chai.assert.isOk Roles.findOne('onduty')
    Roles.remove 'onduty'
    await p
    clock.tick(1000)
