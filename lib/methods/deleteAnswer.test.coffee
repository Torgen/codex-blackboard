'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'deleteAnswer', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    
  it 'fails on non-puzzle', ->
    id = model.Nicks.insert
      name: 'Torgen'
      canon: 'torgen'
      tags: answer: {name: 'Answer',value: 'knock knock', touched: 1, touched_by: 'torgen'}
    chai.assert.throws ->
      Meteor.call 'deleteAnswer',
        type: 'nicks'
        target: id
        who: 'cjb'
    , Match.Error

  ['roundgroups', 'rounds', 'puzzles'].forEach (type) =>
    describe "on #{model.pretty_collection(type)}", ->
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
          tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
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
          tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
        oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
        chai.assert.equal oplogs.length, 1
        chai.assert.include oplogs[0],
          nick: 'cjb'
          timestamp: 7
          body: 'Deleted answer for'
          bodyIsHtml: false
          type: type
          id: id
          oplog: true
          followup: true
          action: true
          system: false
          to: null
          stream: ''

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
          tags:
            answer: {name: 'Answer', value: 'foo', touched: 2, touched_by: 'torgen'}
            temperature: {name: 'Temperature', value: '12', touched: 2, touched_by: 'torgen'}
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
          tags: temperature: {name: 'Temperature', value: '12', touched: 2, touched_by: 'torgen'}
        oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
        chai.assert.equal oplogs.length, 1
        chai.assert.include oplogs[0],
          nick: 'cjb'
          timestamp: 7
          body: 'Deleted answer for'
          bodyIsHtml: false
          type: type
          id: id
          oplog: true
          followup: true
          action: true
          system: false
          to: null
          stream: ''

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
          tags:
            answer: {name: 'Answer', value: 'foo', touched: 2, touched_by: 'torgen'}
            backsolve: {name: 'Backsolve', value: 'yes', touched: 2, touched_by: 'torgen'}
            provided: {name: 'Provided', value: 'yes', touched: 2, touched_by: 'torgen'}
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
          tags: {}
        oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
        chai.assert.equal oplogs.length, 1
        chai.assert.include oplogs[0],
          nick: 'cjb'
          timestamp: 7
          body: 'Deleted answer for'
          bodyIsHtml: false
          type: type
          id: id
          oplog: true
          followup: true
          action: true
          system: false
          to: null
          stream: ''
