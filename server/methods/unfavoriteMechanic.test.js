'use strict'

# For side effects
import '/lib/model.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'unfavoriteMechanic', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'unfavoriteMechanic', 'cryptic_clues'
    , Match.Error

  it 'fails when no such user', ->
    chai.assert.throws ->
      callAs 'unfavoriteMechanic', 'cjb', 'cryptic_clues'
    , Meteor.Error

  describe 'when user has favorite mechanics', ->
    beforeEach ->
      Meteor.users.insert
        _id: 'torgen'
        favorite_mechanics: ['nikoli_variants', 'cryptic_clues']

    it 'removes mechanic', ->
      callAs 'unfavoriteMechanic', 'torgen', 'cryptic_clues'
      chai.assert.deepEqual Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants']

    it 'ignores absent mechanic', ->
      callAs 'unfavoriteMechanic', 'torgen', 'crossword'
      chai.assert.deepEqual Meteor.users.findOne('torgen').favorite_mechanics, ['nikoli_variants', 'cryptic_clues']

    it 'rejects bad mechanic', ->
      chai.assert.throws ->
        callAs 'unfavoriteMechanic', 'torgen', 'minesweeper'
      , Match.Error

  describe 'when user has no favorite mechanics', ->
    beforeEach ->
      Meteor.users.insert
        _id: 'torgen'

    it 'leaves favorite mechanics absent', ->
      callAs 'unfavoriteMechanic', 'torgen', 'cryptic_clues'
      chai.assert.isUndefined Meteor.users.findOne('torgen').favorite_mechanics
