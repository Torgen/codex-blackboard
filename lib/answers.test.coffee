'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'answer method', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  describe 'setAnswer', ->
    it 'fails on non-puzzle', ->
      id = model.Nicks.insert
        name: 'Torgen'
        canon: 'torgen'
        tags: [{name: 'Real Name', canon: 'real_name', value: 'Dan Rosart', touched: 1, touched_by: 'torgen'}]
      chai.assert.throws ->
        Meteor.call 'setAnswer',
          type: 'nicks'
          target: id
          who: 'cjb'
      , Match.Error

    ['roundgroups', 'rounds', 'puzzles'].forEach (type) =>
      describe "on #{type}", ->
        it 'adds answer', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: null
            solved_by: null
            tags: [{name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          chai.assert.isTrue Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
          doc = model.collection(type).findOne id
          chai.assert.deepEqual doc,
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 7
            touched_by: 'cjb'
            solved: 7
            solved_by: 'cjb'
            tags: [{name: 'Answer', canon: 'answer', value: 'bar', touched: 7, touched_by: 'cjb'},
                   {name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
          chai.assert.equal oplogs.length, 1
          chai.assert.include oplogs[0],
            nick: 'cjb'
            timestamp: 7
            body: 'Found an answer (BAR) to'
            bodyIsHtml: false
            type: type
            id: id
            oplog: true
            followup: true
            action: true
            system: false
            to: null
            stream: 'answers'

        it 'changes answer', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags: [{name: 'Answer', canon: 'answer', value: 'qux', touched: 2, touched_by: 'torgen'},
                   {name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          chai.assert.isTrue Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
          doc = model.collection(type).findOne id
          chai.assert.deepEqual doc,
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 7
            touched_by: 'cjb'
            solved: 7
            solved_by: 'cjb'
            tags: [{name: 'Answer', canon: 'answer', value: 'bar', touched: 7, touched_by: 'cjb'},
                   {name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
          chai.assert.equal oplogs.length, 1
          chai.assert.include oplogs[0],
            nick: 'cjb'
            timestamp: 7
            body: 'Found an answer (BAR) to'
            bodyIsHtml: false
            type: type
            id: id
            oplog: true
            followup: true
            action: true
            system: false
            to: null
            stream: 'answers'

        it 'preserves same answer', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags: [{name: 'Answer', canon: 'answer', value: 'bar', touched: 2, touched_by: 'torgen'},
                   {name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          chai.assert.isFalse Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
          doc = model.collection(type).findOne id
          chai.assert.deepEqual doc,
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags: [{name: 'Answer', canon: 'answer', value: 'bar', touched: 2, touched_by: 'torgen'},
                   {name: 'Technology', canon: 'technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}]
          oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
          chai.assert.equal oplogs.length, 0

        it 'modifies tags', ->
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
          chai.assert.isTrue Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
            backsolve: true
            provided: true
          doc = model.collection(type).findOne id
          chai.assert.deepEqual doc,
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 7
            touched_by: 'cjb'
            solved: 7
            solved_by: 'cjb'
            tags: [{name: 'Answer', canon: 'answer', value: 'bar', touched: 7, touched_by: 'cjb'},
                   {name: 'Backsolve', canon: 'backsolve', value: 'yes', touched: 7, touched_by: 'cjb'},
                   {name: 'Provided', canon: 'provided', value: 'yes', touched: 7, touched_by: 'cjb'}]

        it 'cancels callins', ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: null
            solved_by: null
            tags: []
          cid1 = model.CallIns.insert
            type: type
            target: id
            name: 'Foo'
            answer: 'bar'
            created: 5
            created_by: 'codexbot'
            submitted_to_hq: true
            backsolve: false
            provided: false
          cid2 = model.CallIns.insert
            type: type
            target: id
            name: 'Foo'
            answer: 'qux'
            created: 5
            created_by: 'codexbot'
            submitted_to_hq: false
            backsolve: false
            provided: false
          chai.assert.isTrue Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
          chai.assert.lengthOf model.CallIns.find().fetch(), 0, 'all callins deleted'
          chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: 'callins'}).fetch(), 0, 'no oplogs for callins'
          chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: type, id: id}).fetch(), 2, 'oplog for solution and cancelled callin'

  describe 'deleteAnswer', ->
    it 'fails on non-puzzle', ->
      id = model.Nicks.insert
        name: 'Torgen'
        canon: 'torgen'
        tags: [{name: 'Answer', canon: 'answer', value: 'knock knock', touched: 1, touched_by: 'torgen'}]
      chai.assert.throws ->
        Meteor.call 'deleteAnswer',
          type: 'nicks'
          target: id
          who: 'cjb'
      , Match.Error

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
