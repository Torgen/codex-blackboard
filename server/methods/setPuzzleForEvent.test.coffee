'use strict'

# For side effects
import '/lib/model.coffee'
import { CalendarEvents, Puzzles } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'setPuzzleForEvent', ->
  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    Puzzles.insert
      _id: 'puzz'
    CalendarEvents.insert
      _id: 'evt'
    chai.assert.throws ->
      Meteor.call 'setPuzzleForEvent', 'evt', 'puzz'
    , Match.Error

  it 'fails when no such puzzle', ->
    CalendarEvents.insert
      _id: 'evt'
    chai.assert.throws ->
      callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    , Match.Error

  it 'fails when no such event', ->
    Puzzles.insert
      _id: 'puzz'
    chai.assert.isFalse callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'

  it 'sets unset puzzle', ->
    Puzzles.insert
      _id: 'puzz'
    CalendarEvents.insert
      _id: 'evt'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
      puzzle: 'puzz'

  it 'overwrites set puzzle', ->
    Puzzles.insert
      _id: 'puzz'
    CalendarEvents.insert
      _id: 'evt'
      puzzle: 'fizz'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', 'puzz'
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
      puzzle: 'puzz'

  it 'unsets puzzle', ->
    Puzzles.insert
      _id: 'puzz'
    CalendarEvents.insert
      _id: 'evt'
      puzzle: 'puzz'
    callAs 'setPuzzleForEvent', 'cjb', 'evt', null
    chai.assert.deepEqual CalendarEvents.findOne(_id: 'evt'),
      _id: 'evt'
