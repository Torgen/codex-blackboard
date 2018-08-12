'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'addIncorrectAnswer', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()
    
  it 'fails when it doesn\'t exist', ->
    chai.assert.throws ->
      Meteor.call 'newCallIn',
        target: 'something'
        answer: 'precipitate'
        who: 'torgen'
    , Meteor.Error
  
  describe 'which exists', ->
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
        tags: [{name: 'Status', canon: 'status', value: 'stuck', touched: 2, touched_by: 'torgen'}]
        incorrectAnswers: [{answer: 'qux', who: 'torgen', timestamp: 2, backsolve: false, provided: false}]
      model.CallIns.insert
        target: id
        name: 'Foo'
        answer: 'flimflam'
        created: 4
        created_by: 'cjb'
      Meteor.call 'addIncorrectAnswer',
        target: id
        who: 'cjb'
        answer: 'flimflam'

    it 'appends answer', ->
      doc = model.Puzzles.findOne id
      chai.assert.lengthOf doc.incorrectAnswers, 2
      chai.assert.include doc.incorrectAnswers[1],
        answer: 'flimflam'
        who: 'cjb'
        timestamp: 7
        backsolve: false
        provided: false

    it 'doesn\'t touch', ->
      doc = model.Puzzles.findOne id
      chai.assert.include doc,
        touched: 2
        touched_by: 'torgen'

    it 'oplogs', ->
      o = model.Messages.find(room_name: 'oplog/0').fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        type: 'puzzles'
        id: id
        stream: 'callins'
        nick: 'cjb'
      # oplog is lowercase
      chai.assert.include o[0].body, 'flimflam', 'message'

    it 'deletes callin', ->
      chai.assert.lengthOf model.CallIns.find().fetch(), 0
