'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'answer methods', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'deleteAnswer', ->
    ['roundgroups', 'rounds', 'puzzles'].forEach (type) =>
      describe "on #{type}", ->
        it 'works when unanswered', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: null
            solved_by: null
            tags: [{name: 'Status', canon: 'status', value: 'stuck', touched: 2, touched_by: 'torgen'}]
          Meteor.call 'deleteAnswer',
            type: type
            target: id,
            who: 'cjb'
          doc = model.collection(type).findOne id
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
            tags: [{name: 'Status', canon: 'status', value: 'stuck', touched: 2, touched_by: 'torgen'}]
          # TODO(torgen): check for oplog

        it 'removes answer', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags: [{name: 'Answer', canon: 'answer', value: 'foo', touched: 2, touched_by: 'torgen'},
                  {name: 'Temperature', canon: 'temperature', value: '12', touched: 2, touched_by: 'torgen'}]
          Meteor.call 'deleteAnswer',
            type: type
            target: id,
            who: 'cjb'
          doc = model.collection(type).findOne id
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
            tags: [{name: 'Temperature', canon: 'temperature', value: '12', touched: 2, touched_by: 'torgen'}]
          # TODO(torgen): check for oplog

        it 'removes backsolve and provided', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags: [{name: 'Answer', canon: 'answer', value: 'foo', touched: 2, touched_by: 'torgen'},
                  {name: 'Backsolve', canon: 'backsolve', value: 'yes', touched: 2, touched_by: 'torgen'},
                  {name: 'Provided', canon: 'provided', value: 'yes', touched: 2, touched_by: 'torgen'}]
          Meteor.call 'deleteAnswer',
            type: type
            target: id,
            who: 'cjb'
          doc = model.collection(type).findOne id
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
            tags: []
          # TODO(torgen): check for oplog
