'use strict'

# Will access contents via share
import '../model.coffee'
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

  ['puzzles', 'rounds', 'roundgroups'].forEach (type) =>
    describe "for #{model.pretty_collection(type)}", ->
      puzzle = null
      callin = null
      beforeEach ->
        puzzle = model.collection(type).insert
          name: 'Foo'
          canon: 'foo'
          created: 1
          created_by: 'cscott'
          touched: 1
          touched_by: 'cscott'
          solved: null
          solved_by: null
          tags: {}
        callin = model.CallIns.insert
          name: 'Foo:precipitate'
          type: type
          target: puzzle
          answer: 'precipitate'
          created: 2
          created_by: 'torgen'
          submitted_to_hq: true
          backsolve: false
          provided: false
        Meteor.call 'correctCallIn',
          id: callin
          who: 'cjb'

      it "updates #{model.pretty_collection(type)}", ->
        doc = model.collection(type).findOne puzzle
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
        o = model.Messages.find(room_name: 'oplog/0').fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          type: type
          id: puzzle
          stream: 'answers'
          nick: 'cjb'
        chai.assert.include o[0].body, '(PRECIPITATE)', 'message'

      it "notifies #{model.pretty_collection(type)} chat", ->
        o = model.Messages.find(room_name: "#{type}/#{puzzle}").fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.notInclude o[0].body, '(Foo)', 'message'

      it 'notifies general chat', ->
        o = model.Messages.find(room_name: "general/0").fetch()
        chai.assert.lengthOf o, 1
        chai.assert.include o[0],
          nick: 'cjb'
          action: true
        chai.assert.include o[0].body, 'PRECIPITATE', 'message'
        chai.assert.include o[0].body, '(Foo)', 'message'

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
      created_by: 'torgen'
      touched: 2
      touched_by: 'cscott'
      solved: null
      solved_by: null
      puzzles: [p]
      tags: {}
      incorrectAnswers: []
    callin = model.CallIns.insert
      name: 'Foo:precipitate'
      type: 'puzzles'
      target: p
      answer: 'precipitate'
      created: 2
      created_by: 'torgen'
      submitted_to_hq: true
      backsolve: false
      provided: false
    Meteor.call 'correctCallIn',
      id: callin
      who: 'cjb'
    m = model.Messages.find(room_name: "rounds/#{r}").fetch()
    chai.assert.lengthOf m, 1
    chai.assert.include m[0],
      nick: 'cjb'
      action: true
    chai.assert.include m[0].body, 'PRECIPITATE'
    chai.assert.include m[0].body, '(Foo)'
