'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'incorrectCallIn', ->
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
          tags: []
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
        Meteor.call 'incorrectCallIn',
          id: callin
          who: 'cjb'
    
      it 'deletes callin', ->
        chai.assert.isUndefined model.CallIns.findOne()

      it 'addsIncorrectAnswer', ->
        chai.assert.deepInclude model.collection(type).findOne(puzzle),
          incorrectAnswers: [{answer: 'precipitate', who: 'cjb', timestamp: 7, backsolve: false, provided: false}]

      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({type: type, id: puzzle, stream: 'callins'}).fetch(), 1

      it "notifies #{model.pretty_collection(type)} chat", ->
        chai.assert.lengthOf model.Messages.find(room_name: "#{type}/#{puzzle}").fetch(), 1

      it "notifies general chat", ->
        chai.assert.lengthOf model.Messages.find(room_name: 'general/0').fetch(), 1