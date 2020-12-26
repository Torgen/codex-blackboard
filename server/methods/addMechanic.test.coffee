'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'addMechanic', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    
  it 'fails when it doesn\'t exist', ->
    chai.assert.throws ->
      callAs 'addMechanic', 'torgen', 'id', 'cryptic_clues'
    , Meteor.Error
  
  describe 'to puzzle with empty mechanics', ->
    id = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: null
        solved_by: null
        tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
        
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'addMechanic', id, 'cryptic_clues'
      , Match.Error
        
    describe 'when logged in', ->
      beforeEach ->
        callAs 'addMechanic', 'cjb', id, 'cryptic_clues'

      it 'appends mechanic', ->
        doc = model.Puzzles.findOne id
        chai.assert.deepInclude doc, mechanics: ['cryptic_clues']

      it 'touches', ->
        doc = model.Puzzles.findOne id
        chai.assert.include doc,
          touched: 7
          touched_by: 'cjb'
  
  describe 'to puzzle with mechanics', ->
    id = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 2
        touched_by: 'torgen'
        solved: null
        solved_by: null
        tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
        mechanics: ['nikoli_variants']
        
    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'addMechanic', id, 'cryptic_clues'
      , Match.Error
        
    describe 'when logged in', ->
      it 'fails with invalid mechanic', ->
        chai.assert.throws ->
          callAs 'addMechanic', 'torgen', id, 'eating_contest'
        , Match.Error

      describe 'with new mechanic', ->
        beforeEach ->
          callAs 'addMechanic', 'cjb', id, 'cryptic_clues'

        it 'appends mechanic', ->
          doc = model.Puzzles.findOne id
          chai.assert.deepInclude doc, mechanics: ['nikoli_variants', 'cryptic_clues']

        it 'touches', ->
          doc = model.Puzzles.findOne id
          chai.assert.include doc,
            touched: 7
            touched_by: 'cjb'

      describe 'with existing mechanic', ->
        beforeEach ->
          callAs 'addMechanic', 'cjb', id, 'nikoli_variants'

        it 'leaves mechanics unchanged', ->
          doc = model.Puzzles.findOne id
          chai.assert.deepInclude doc, mechanics: ['nikoli_variants']

        it 'touches', ->
          doc = model.Puzzles.findOne id
          chai.assert.include doc,
            touched: 7
            touched_by: 'cjb'
