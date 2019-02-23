'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'correctCallIn', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  puzzle = null
  callin = null
  beforeEach ->
    puzzle = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'cscott'
      touched: 1
      touched_by: 'cscott'
      solved: null
      solved_by: null
      tags: {}
      feedsInto: []
    callin = model.CallIns.insert
      name: 'Foo:precipitate'
      target: puzzle
      answer: 'precipitate'
      created: 2
      created_by: 'torgen'
      submitted_to_hq: true
      backsolve: false
      provided: false
  
  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'correctCallIn', callin
    , Match.Error

  describe 'when logged in', ->
    beforeEach ->
      Meteor.callAs 'correctCallIn', 'cjb', callin

    it 'updates puzzle', ->
      doc = model.Puzzles.findOne puzzle
      chai.assert.deepInclude doc,
        touched: 7
        touched_by: 'cjb'
        solved: 7
        solved_by: 'cjb'
        tags: answer:
          name: 'Answer'
          value: 'precipitate'
          touched: 7
          touched_by: 'cjb'
    
    it 'removes callin', ->
      chai.assert.isUndefined model.CallIns.findOne callin

    it 'oplogs', ->
      o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        type: 'puzzles'
        id: puzzle
        stream: 'answers'
        nick: 'cjb'
      chai.assert.include o[0].body, '(PRECIPITATE)', 'message'

    it 'notifies puzzle chat', ->
      o = model.Messages.find(room_name: "puzzles/#{puzzle}", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        nick: 'cjb'
        action: true
      chai.assert.include o[0].body, 'PRECIPITATE', 'message'
      chai.assert.notInclude o[0].body, '(Foo)', 'message'

    it 'notifies general chat', ->
      o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
      chai.assert.lengthOf o, 1
      chai.assert.include o[0],
        nick: 'cjb'
        action: true
      chai.assert.include o[0].body, 'PRECIPITATE', 'message'
      chai.assert.include o[0].body, '(Foo)', 'message'

  it 'notifies meta chat for puzzle', ->
    meta = model.Puzzles.insert
      name: 'Meta'
      canon: 'meta'
      created: 2
      created_by: 'cscott'
      touched: 2
      touched_by: 'cscott'
      solved: null
      solved_by: null
      tags: {}
      incorrectAnswers: []
      feedsInto: []
      puzzles: [puzzle]
    model.Puzzles.update puzzle, $push: feedsInto: meta
    Meteor.callAs 'correctCallIn', 'cjb', callin
    m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
    chai.assert.lengthOf m, 1
    chai.assert.include m[0],
      nick: 'cjb'
      action: true
    chai.assert.include m[0].body, 'PRECIPITATE'
    chai.assert.include m[0].body, '(Foo)'
