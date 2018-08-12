'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newQuip', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  id = null

  beforeEach ->
    resetDatabase()
    id = Meteor.call 'newQuip',
      who: 'torgen'
      text: 'I\'m codex, and there are wolves after me.'
    ._id
  
  it 'creates document', ->
    chai.assert.include model.Quips.findOne(id),
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      last_used: 0
      use_count: 0
      text: 'I\'m codex, and there are wolves after me.'
      name: 'Odessa Clayter'  # from hash of text

  it 'oplogs', ->
    chai.assert.lengthOf model.Messages.find({type: 'quips', id: id}).fetch(), 1

    

  