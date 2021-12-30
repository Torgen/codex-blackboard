'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setPuzzleForEvent', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    model.Puzzles.insert
      _id: 'puzz'
    model.CalendarEvents.insert
      _id: 'evt'
    chai.assert.throws ->
      Meteor.call 'setPuzzleForEvent', 'evt', 'puzz'
    , Match.Error

  it 'fails when no such puzzle', ->
    model.CalendarEvents.insert
      _id: 'evt'
    chai.assert.throws ->
      callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    , Match.Error

  it 'fails when no such event', ->
    model.Puzzles.insert
      _id: 'puzz'
    chai.assert.isFalse callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'

  it 'sets unset puzzle', ->
    model.Puzzles.insert
      _id: 'puzz'
    model.CalendarEvents.insert
      _id: 'evt'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
      puzzle: 'puzz'

  it 'overwrites set puzzle', ->
    model.Puzzles.insert
      _id: 'puzz'
    model.CalendarEvents.insert
      _id: 'evt'
      puzzle: 'fizz'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
      puzzle: 'puzz'

  it 'unsets puzzle', ->
    model.Puzzles.insert
      _id: 'puzz'
    model.CalendarEvents.insert
      _id: 'evt'
      puzzle: 'puzz'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', null
    chai.assert.deepEqual model.CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
