'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'makeNotMeta', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
  
  it 'fails without login', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 2
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: []
      tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    chai.assert.throws ->
      Meteor.call 'makeNotMeta', id
    , Match.Error
  
  it 'works when empty', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 2
      touched_by: 'torgen'
      solved: null
      solved_by: null
      puzzles: []
      tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
    chai.assert.isTrue callAs 'makeNotMeta', 'cjb', id
    doc = model.Puzzles.findOne id
    chai.assert.deepEqual doc,
      _id: id
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 7
      touched_by: 'cjb'
      solved: null
      solved_by: null
      tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}

  it 'fails when not empty', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 2
      touched_by: 'torgen'
      solved: 2
      solved_by: 'torgen'
      puzzles: ['bar']
      tags:
        answer: {name: 'Answer', value: 'foo', touched: 2, touched_by: 'torgen'}
        temperature: {name: 'Temperature', value: '12', touched: 2, touched_by: 'torgen'}
    chai.assert.isFalse callAs 'makeNotMeta', 'cjb', id
    doc = model.Puzzles.findOne id
    chai.assert.deepEqual doc,
      _id: id
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 2
      touched_by: 'torgen'
      puzzles: ['bar']
      solved: 2
      solved_by: 'torgen'
      tags: 
        answer: {name: 'Answer', value: 'foo', touched: 2, touched_by: 'torgen'}
        temperature: {name: 'Temperature', value: '12', touched: 2, touched_by: 'torgen'}