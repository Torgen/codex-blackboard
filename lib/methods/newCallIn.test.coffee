'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import '../../server/000servercall.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'newCallIn', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers(7)

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'fails when it doesn\'t exist', ->
    chai.assert.throws ->
      Meteor.callAs 'newCallIn', 'torgen',
        target: 'something'
        answer: 'precipitate'
    , Meteor.Error

  describe 'which exists', ->
    id = null
    beforeEach ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'cscott'
        touched: 1
        touched_by: 'cscott'
        solved: null
        solved_by: null
        tags: {}
        incorrectAnswers: []
        feedsInto: []

    it 'fails without login', ->
      chai.assert.throws ->
        Meteor.call 'newCallIn',
          target: id
          answer: 'precipitate'
      , Match.Error

    describe 'with simple callin', ->
      beforeEach ->
        Meteor.callAs 'newCallIn', 'torgen',
          target: id
          answer: 'precipitate'

      it 'creates document', ->
        c = model.CallIns.findOne()
        chai.assert.include c,
          name: 'Foo:precipitate'
          target: id
          answer: 'precipitate'
          who: 'torgen'
          submitted_to_hq: false
          backsolve: false
          provided: false

      it 'oplogs', ->
        o = model.Messages.find(room_name: 'oplog/0', dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          type: 'puzzles'
          id: id
          stream: 'callins'
          nick: 'torgen'
        # oplog is lowercase
        chai.assert.include o[0].body, 'precipitate', 'message'

      it 'notifies puzzle chat', ->
        o = model.Messages.find(room_name: "puzzles/#{id}", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'torgen'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0", dawn_of_time: $ne: true).fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'torgen'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'
  
    it 'sets backsolve', ->
      Meteor.callAs 'newCallIn', 'torgen',
        target: id
        answer: 'precipitate'
        backsolve: true
      c = model.CallIns.findOne()
      chai.assert.include c,
        target: id
        answer: 'precipitate'
        who: 'torgen'
        submitted_to_hq: false
        backsolve: true
        provided: false
    
    it 'sets provided', ->
      Meteor.callAs 'newCallIn', 'torgen',
        target: id
        answer: 'precipitate'
        provided: true
      c = model.CallIns.findOne()
      chai.assert.include c,
        target: id
        answer: 'precipitate'
        who: 'torgen'
        submitted_to_hq: false
        backsolve: false
        provided: true

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
    p = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 2
      created_by: 'cscott'
      touched: 2
      touched_by: 'cscott'
      solved: null
      solved_by: null
      tags: {}
      incorrectAnswers: []
      feedsInto: [meta]
    model.Puzzles.update meta, $push: puzzles: p
    r = model.Rounds.insert
      name: 'Bar'
      canon: 'bar'
      created: 1
      created_by: 'cjb'
      touched: 2
      touched_by: 'cscott'
      puzzles: [meta, p]
      tags: {}
    Meteor.callAs 'newCallIn', 'torgen',
      target: p
      answer: 'precipitate'
    m = model.Messages.find(room_name: "puzzles/#{meta}", dawn_of_time: $ne: true).fetch()
    chai.assert.lengthOf m, 1
    chai.assert.include m[0],
      nick: 'torgen'
      action: true
    chai.assert.include m[0].body, 'PRECIPITATE'
    chai.assert.include m[0].body, '(Foo)'
