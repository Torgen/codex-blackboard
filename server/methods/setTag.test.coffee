'use strict'

# Will access contents via share
import '../model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs } from '../../server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'setTag', ->
  clock = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      feedsInto: []
      created: 1
      created_by: 'cjb'
      touched: 3
      touched_by: 'cscott'
      solved: 3
      solved_by: 'cscott'
      tags:
        answer:
          name: 'Answer'
          value: 'bar'
          touched_by: 'cscott'
          touched: 3
    chai.assert.throws ->
      Meteor.call 'setTag',
        type: 'puzzles'
        object: id
        name: 'Cares About'
        value: 'temperature'
    , Match.Error

  it 'adds new tag', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      feedsInto: []
      created: 1
      created_by: 'cjb'
      touched: 3
      touched_by: 'cscott'
      solved: 3
      solved_by: 'cscott'
      tags:
        answer:
          name: 'Answer'
          value: 'bar'
          touched_by: 'cscott'
          touched: 3
    callAs 'setTag', 'torgen',
      type: 'puzzles'
      object: id
      name: 'Cares About'
      value: 'temperature'
    chai.assert.deepInclude model.Puzzles.findOne(id),
      created: 1
      created_by: 'cjb'
      touched: 7
      touched_by: 'torgen'
      solved: 3
      solved_by: 'cscott'
      tags:
        answer:
          name: 'Answer'
          value: 'bar'
          touched_by: 'cscott'
          touched: 3
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 7
          touched_by: 'torgen'

  it 'overwrites old tag', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      feedsInto: []
      created: 1
      created_by: 'cjb'
      touched: 3
      touched_by: 'cscott'
      tags:
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 3
          touched_by: 'cscott'
    callAs 'setTag', 'torgen',
      type: 'puzzles'
      object: id
      name: 'Cares About'
      value: 'temperature,pressure'

    chai.assert.deepInclude model.Puzzles.findOne(id),
      created: 1
      created_by: 'cjb'
      touched: 7
      touched_by: 'torgen'
      tags:
        cares_about:
          name: 'Cares About'
          value: 'temperature,pressure'
          touched: 7
          touched_by: 'torgen'

  it 'defers to setAnswer', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      feedsInto: []
      created: 1
      created_by: 'cjb'
      touched: 3
      touched_by: 'cscott'
      tags:
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 3
          touched_by: 'cscott'
    callAs 'setTag', 'torgen',
      type: 'puzzles'
      object: id
      name: 'answEr'
      value: 'bar'

    chai.assert.deepInclude model.Puzzles.findOne(id),
      created: 1
      created_by: 'cjb'
      touched: 7
      touched_by: 'torgen'
      solved: 7
      solved_by: 'torgen'
      tags:
        answer:
          name: 'Answer'
          value: 'bar'
          touched_by: 'torgen'
          touched: 7
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 3
          touched_by: 'cscott'
    chai.assert.include model.Messages.findOne(room_name: 'oplog/0', body: 'Found an answer (BAR) to'),
      id: id
      nick: 'torgen'
      oplog: true
      type: 'puzzles'
      stream: 'answers'

  it 'sets link', ->
    id = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      feedsInto: []
      created: 1
      created_by: 'cjb'
      touched: 3
      touched_by: 'cscott'
      tags:
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 3
          touched_by: 'cscott'
    callAs 'setTag', 'torgen',
      type: 'puzzles'
      object: id
      name: 'link'
      value: 'https://moliday.holasses/puzzles/foo'

    chai.assert.deepInclude model.Puzzles.findOne(id),
      created: 1
      created_by: 'cjb'
      touched: 7
      touched_by: 'torgen'
      link: 'https://moliday.holasses/puzzles/foo'
      tags:
        cares_about:
          name: 'Cares About'
          value: 'temperature'
          touched: 3
          touched_by: 'cscott'
    chai.assert.doesNotHaveAnyKeys model.Puzzles.findOne(id).tags, ['link']