'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'favoriteMechanic', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'favoriteMechanic', 'cryptic_clues'
    , Match.Error

  it 'fails when no such user', ->
    chai.assert.throws ->
      callAs 'favoriteMechanic', 'cjb', 'cryptic_clues'
    , Meteor.Error

  describe 'when user has favorite mechanics', ->
    beforeEach ->
      Meteor.users.insert
        _id: 'torgen'
        favorite_mechanics: ['nikoli_variants']

    it 'adds new mechanic', ->
      callAs 'favoriteMechanic', 'torgen', 'cryptic_clues'
      chai.assert.deepEqual Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants', 'cryptic_clues']

    it 'will not duplicate mechanic', ->
      callAs 'favoriteMechanic', 'torgen', 'nikoli_variants'
      chai.assert.deepEqual Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants']

    it 'rejects bad mechanic', ->
      chai.assert.throws ->
        callAs 'favoriteMechanic', 'torgen', 'minesweeper'
      , Match.Error

  describe 'when user has no favorite mechanics', ->
    beforeEach ->
      Meteor.users.insert
        _id: 'torgen'

    it 'creates favorite mechanics', ->
      callAs 'favoriteMechanic', 'torgen', 'cryptic_clues'
      chai.assert.deepEqual Meteor.users.findOne('torgen').favorite_mechanics, ['cryptic_clues']
