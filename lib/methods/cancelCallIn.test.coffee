'use strict'

# Will access contents via share
import '../model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'cancelCallIn', ->
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
        Meteor.call 'cancelCallIn',
          id: callin
          who: 'cjb'

      it 'deletes callin', ->
        chai.assert.isUndefined model.CallIns.findOne()
      
      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({type: type, id: puzzle}).fetch(), 1
    