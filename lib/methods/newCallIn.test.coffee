'use strict'

# Will access contents via share
import '../model.coffee'
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

  it 'fails for non-puzzle type', ->
    chai.assert.throws ->
      id = model.Nicks.insert 
        name: 'Torgen'
        canon: 'torgen'
      Meteor.call 'newCallIn',
        type: 'nicks'
        target: id
        answer: 'precipitate'
        who: 'torgen'
    , Match.Error

  ['puzzles', 'rounds', 'roundgroups'].forEach (type) =>
    describe "for #{model.pretty_collection(type)}", ->
      it 'fails when it doesn\'t exist', ->
        chai.assert.throws ->
          Meteor.call 'newCallIn',
            type: type
            target: 'something'
            answer: 'precipitate'
            who: 'torgen'
        , Meteor.Error

      describe 'which exists', ->
        id = null
        beforeEach ->
          id = model.collection(type).insert
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

        describe 'with simple callin', ->
          beforeEach ->
            Meteor.call 'newCallIn',
              type: type
              target: id
              answer: 'precipitate'
              who: 'torgen'

          it 'creates document', ->
            c = model.CallIns.findOne()
            chai.assert.include c,
              name: 'Foo:precipitate'
              type: type
              target: id
              answer: 'precipitate'
              who: 'torgen'
              submitted_to_hq: false
              backsolve: false
              provided: false

          it 'oplogs', ->
            o = model.Messages.find(room_name: 'oplog/0').fetch()
            chai.assert.lengthOf o, 1
            chai.assert.include o[0],
              type: type
              id: id
              stream: 'callins'
              nick: 'torgen'
            # oplog is lowercase
            chai.assert.include o[0].body, 'precipitate', 'message'

          it "notifies #{model.pretty_collection(type)} chat", ->
            o = model.Messages.find(room_name: "#{type}/#{id}").fetch()
            chai.assert.lengthOf o, 1
            chai.assert.include o[0],
              nick: 'torgen'
              action: true
            chai.assert.include o[0].body, 'PRECIPITATE', 'message'
            chai.assert.notInclude o[0].body, '(Foo)', 'message'

          it 'notifies general chat', ->
            o = model.Messages.find(room_name: "general/0").fetch()
            chai.assert.lengthOf o, 1
            chai.assert.include o[0],
              nick: 'torgen'
              action: true
            chai.assert.include o[0].body, 'PRECIPITATE', 'message'
            chai.assert.include o[0].body, '(Foo)', 'message'
      
        it 'sets backsolve', ->
          Meteor.call 'newCallIn',
            type: type
            target: id
            answer: 'precipitate'
            who: 'torgen'
            backsolve: true
          c = model.CallIns.findOne()
          chai.assert.include c,
            type: type
            target: id
            answer: 'precipitate'
            who: 'torgen'
            submitted_to_hq: false
            backsolve: true
            provided: false
        
        it 'sets provided', ->
          Meteor.call 'newCallIn',
            type: type
            target: id
            answer: 'precipitate'
            who: 'torgen'
            provided: true
          c = model.CallIns.findOne()
          chai.assert.include c,
            type: type
            target: id
            answer: 'precipitate'
            who: 'torgen'
            submitted_to_hq: false
            backsolve: false
            provided: true

  it 'notifies round chat for puzzle', ->
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
    r = model.Rounds.insert
      name: 'Bar'
      canon: 'bar'
      created: 1
      created_by: 'cjb'
      touched: 2
      touched_by: 'cscott'
      solved: null
      solved_by: null
      puzzles: [p]
      tags: {}
      incorrectAnswers: []
    Meteor.call 'newCallIn',
      type: 'puzzles'
      target: p
      answer: 'precipitate'
      who: 'torgen'
    m = model.Messages.find(room_name: "rounds/#{r}").fetch()
    chai.assert.lengthOf m, 1
    chai.assert.include m[0],
      nick: 'torgen'
      action: true
    chai.assert.include m[0].body, 'PRECIPITATE'
    chai.assert.include m[0].body, '(Foo)'
