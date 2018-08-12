'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setAnswer', ->
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
      tags: real_name: {name: 'Real Name', value: 'Dan Rosart', touched: 1, touched_by: 'torgen'}
    chai.assert.throws ->
      Meteor.call 'setAnswer',
        type: 'nicks'
        target: id
        who: 'cjb'
    , Match.Error

  ['roundgroups', 'rounds', 'puzzles'].forEach (type) =>
    describe "on #{model.pretty_collection(type)}", ->
      describe 'without answer', ->
        id = null
        ret = null
        beforeEach ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: null
            solved_by: null
            tags: technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
          ret = Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'

        it 'returns true', ->
          chai.assert.isTrue ret

        it 'modifies document', ->
          chai.assert.deepEqual model.collection(type).findOne(id),
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 7
            touched_by: 'cjb'
            solved: 7
            solved_by: 'cjb'
            tags:
              answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
              technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
        
        it 'oplogs', ->
          oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
          chai.assert.equal oplogs.length, 1
          chai.assert.include oplogs[0],
            nick: 'cjb'
            timestamp: 7
            type: type
            id: id
            oplog: true
            action: true
            stream: 'answers'

      describe 'with answer', ->
        id = null
        ret = null
        beforeEach ->
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
              answer: {name: 'Answer', value: 'qux', touched: 2, touched_by: 'torgen'}
              technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
          ret = Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
        
        it 'returns true', ->
          chai.assert.isTrue ret

        it 'modifies document', ->
          chai.assert.deepEqual model.collection(type).findOne(id),
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 7
            touched_by: 'cjb'
            solved: 7
            solved_by: 'cjb'
            tags:
              answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
              technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
        
        it 'oplogs', ->
          oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
          chai.assert.equal oplogs.length, 1
          chai.assert.include oplogs[0],
            nick: 'cjb'
            timestamp: 7
            bodyIsHtml: false
            type: type
            id: id
            oplog: true
            action: true
            stream: 'answers'

      describe 'with same answer', ->
        id = null
        ret = null
        beforeEach ->
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
              answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'}
              technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}
          ret = Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'

        it 'returns false', ->
          chai.assert.isFalse ret

        it 'leaves document alone', ->
          chai.assert.deepEqual model.collection(type).findOne(id),
            _id: id
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: 2
            solved_by: 'torgen'
            tags:
              answer: {name: 'Answer', value: 'bar', touched: 2, touched_by: 'torgen'}
              technology: {name: 'Technology', value: 'Pottery', touched: 2, touched_by: 'torgen'}

        it 'doesn\'t oplog', ->
          chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0

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
          tags: status: {name: 'Status', value: 'stuck', touched: 2, touched_by: 'torgen'}
        chai.assert.isTrue Meteor.call 'setAnswer',
          type: type
          target: id
          who: 'cjb'
          answer: 'bar'
          backsolve: true
          provided: true
        chai.assert.deepInclude model.collection(type).findOne(id),
          tags:
            answer: {name: 'Answer', value: 'bar', touched: 7, touched_by: 'cjb'}
            backsolve: {name: 'Backsolve', value: 'yes', touched: 7, touched_by: 'cjb'}
            provided: {name: 'Provided', value: 'yes', touched: 7, touched_by: 'cjb'}

      describe 'with matching callins', ->
        id = null
        cid1 = null
        cid2 = null
        beforeEach ->
          id = model.collection(type).insert
            name: 'Foo'
            canon: 'foo'
            created: 1
            created_by: 'cscott'
            touched: 2
            touched_by: 'torgen'
            solved: null
            solved_by: null
            tags: {}
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
          Meteor.call 'setAnswer',
            type: type
            target: id
            who: 'cjb'
            answer: 'bar'
        it 'deletes callins', ->
          chai.assert.lengthOf model.CallIns.find().fetch(), 0

        it 'doesn\'t oplog for callins', ->
          chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: 'callins'}).fetch(), 0

        it "oplogs for #{model.pretty_collection(type)}", ->
          chai.assert.lengthOf model.Messages.find({room_name: 'oplog/0', type: type, id: id}).fetch(), 2
