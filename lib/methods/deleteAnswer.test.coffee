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

  it 'works when unanswered', ->
    id = model.Puzzles.insert
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
      target: id,
      who: 'cjb'
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
      tags: [{name: 'Status', canon: 'status', value: 'stuck', touched: 2, touched_by: 'torgen'}]
    oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
    chai.assert.equal oplogs.length, 1
    chai.assert.include oplogs[0],
      nick: 'cjb'
      timestamp: 7
      body: 'Deleted answer for'
      bodyIsHtml: false
      type: 'puzzles'
      id: id
      oplog: true
      followup: true
      action: true
      system: false
      to: null
      stream: ''

  it 'removes answer', ->
    id = model.Puzzles.insert
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
      target: id,
      who: 'cjb'
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
      tags: [{name: 'Temperature', canon: 'temperature', value: '12', touched: 2, touched_by: 'torgen'}]
    oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
    chai.assert.equal oplogs.length, 1
    chai.assert.include oplogs[0],
      nick: 'cjb'
      timestamp: 7
      body: 'Deleted answer for'
      bodyIsHtml: false
      type: 'puzzles'
      id: id
      oplog: true
      followup: true
      action: true
      system: false
      to: null
      stream: ''

  it 'removes backsolve and provided', ->
    id = model.Puzzles.insert
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
      target: id,
      who: 'cjb'
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
      tags: []
    oplogs = model.Messages.find(room_name: 'oplog/0').fetch()
    chai.assert.equal oplogs.length, 1
    chai.assert.include oplogs[0],
      nick: 'cjb'
      timestamp: 7
      body: 'Deleted answer for'
      bodyIsHtml: false
      type: 'puzzles'
      id: id
      oplog: true
      followup: true
      action: true
      system: false
      to: null
      stream: ''
