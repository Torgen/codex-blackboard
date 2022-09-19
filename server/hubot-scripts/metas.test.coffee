'use strict'

import metas from './metas.coffee'
import '/lib/model.coffee'
import { Messages, Puzzles } from '/lib/imports/collections.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '/lib/imports/testutils.coffee'
import { impersonating } from '../imports/impersonate.coffee'

describe 'metas hubot script', ->
  robot = null
  clock = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 6
      toFake: ["Date"]
    # can't use plain hubot because this script uses priv, which isn't part of
    # the standard message class or adapter.
    robot = new Robot 'testbot', 'testbot@testbot.test'
    metas robot
    robot.run()
    clock.tick 1

  afterEach ->
    robot.shutdown()
    clock.restore()

  ['meta', 'metapuzzle'].forEach (descriptor) ->
    [['make ', 'a'], ['', 'is a']].forEach ([before, after]) ->
      describe "#{before}it #{after} #{descriptor}", ->
        describe 'in puzzle room', ->
          it 'infers puzzle from this', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            await waitForDocument Puzzles, {_id: '12345abcde', puzzles: []},
              touched: 7
              touched_by: 'torgen'
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, this is now a meta.'

          it 'Fails when already meta', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: this was already a meta.'
              useful: true
              mention: ['torgen']
              
          it 'can specify puzzle', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            await waitForDocument Puzzles, {_id: 'fghij67890', puzzles: []},
              touched: 7
              touched_by: 'torgen'
            chai.assert.isUndefined Puzzles.findOne('12345abcde').puzzles
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, even this poem is now a meta.'
              
          it 'fails when no such puzzle', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
              mention: ['torgen']
            chai.assert.isUndefined Puzzles.findOne('12345abcde').puzzles

        describe 'in general room', ->
          it 'must specify puzzle', ->
            Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              body: '@torgen: You need to tell me which puzzle this is for.'
              useful: true
              mention: ['torgen']
              
          it 'can specify puzzle', ->
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
            Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            await waitForDocument Puzzles, {_id: 'fghij67890', puzzles: []},
              touched: 7
              touched_by: 'torgen'
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, even this poem is now a meta.'

    ['isn\'t', 'is not'].forEach (verb) ->
      describe "it #{verb} a #{descriptor}", ->
        describe 'in puzzle room', ->
          it 'infers puzzle from this', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            await waitForDocument Puzzles, {_id: '12345abcde', puzzles: null},
              touched: 7
              touched_by: 'torgen'
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, this is no longer a meta.'

          it 'fails when it has a puzzle', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: ['a']
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: 1 puzzle feeds into Latino Alphabet. It must be a meta.'
              useful: true
              mention: ['torgen']
            chai.assert.deepInclude Puzzles.findOne('12345abcde'),
              puzzles: ['a']

          it 'fails when it has multiple puzzles', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: ['a', 'b', 'c']
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: 3 puzzles feed into Latino Alphabet. It must be a meta.'
              useful: true
              mention: ['torgen']
            chai.assert.deepInclude Puzzles.findOne('12345abcde'),
              puzzles: ['a', 'b', 'c']

          it 'fails when not meta', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: this already wasn\'t a meta.'
              useful: true
              mention: ['torgen']

          it 'can specify puzzle', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            await waitForDocument Puzzles, {_id: 'fghij67890', puzzles: null},
              touched: 7
              touched_by: 'torgen'
            chai.assert.deepInclude Puzzles.findOne('12345abcde'),
              puzzles: []
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, even this poem is no longer a meta.'

          it 'fails when no such puzzle', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: '@torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
              mention: ['torgen']
            chai.assert.deepInclude Puzzles.findOne('12345abcde'),
              puzzles: []

        describe 'in general room', ->
          it 'must specify puzzle', ->
            Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              body: '@torgen: You need to tell me which puzzle this is for.'
              useful: true
              mention: ['torgen']

          it 'can specify puzzle', ->
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: []
            Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            await waitForDocument Puzzles, {_id: 'fghij67890', puzzles: null},
              touched: 7
              touched_by: 'torgen'
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              useful: true
              mention: ['torgen']
              body: '@torgen: OK, even this poem is no longer a meta.'

  describe 'feeds into', ->
    describe 'in puzzle room', ->
      it 'feeds this into that', ->
        Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        Messages.insert
          room_name: 'puzzles/12345abcde'
          timestamp: 7
          nick: 'torgen'
          body: 'bot this feeds into even this poem'
        l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'puzzles/12345abcde'
          useful: true
          mention: ['torgen']
        Promise.all [l, e, m]

      it 'feeds that into this', ->
        Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        Messages.insert
          room_name: 'puzzles/fghij67890'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into this'
        l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'puzzles/fghij67890'
          useful: true
          mention: ['torgen']
        Promise.all [l, e, m]

      it 'feeds that into the other', ->
        Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        Puzzles.insert
          _id: '0000000000'
          name: 'A Third Thing'
          canon: 'a_third_thing'
          feedsInto: []
        Messages.insert
          room_name: 'puzzles/0000000000'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into even this poem'
        l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'puzzles/0000000000'
          useful: true
          mention: ['torgen']
        await Promise.all [l, e, m]
        chai.assert.deepInclude Puzzles.findOne('0000000000'),
          feedsInto: []
        chai.assert.isUndefined Puzzles.findOne('0000000000').puzzles

    describe 'in general room', ->
      it 'fails to feed this into that', ->
        Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot this feeds into even this poem'
        await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'general/0'
          body: '@torgen: You need to tell me which puzzle this is for.'
          useful: true
          mention: ['torgen']
        chai.assert.isUndefined Puzzles.findOne('fghij67890').puzzles

      it 'fails to feed that into this', ->
        Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
          touched: 2
          touched_by: 'cjb'
        Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into this'
        await waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'general/0'
          body: '@torgen: You need to tell me which puzzle this is for.'
          useful: true
          mention: ['torgen']
        chai.assert.deepInclude Puzzles.findOne('12345abcde'),
          feedsInto: []
          touched: 2
          touched_by: 'cjb'

      it 'feeds that into the other', ->
        Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into even this poem'
        l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'general/0'
          useful: true
          mention: ['torgen']
        Promise.all [l, e, m]

  ['doesn\'t', 'does not'].forEach (verb) ->
    describe "#{verb} feed into", ->
      describe 'in puzzle room', ->
        describe 'this from that', ->
          it 'removes this', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              body: '@torgen: OK, this no longer feeds into even this poem.'
              useful: true
              room_name: 'puzzles/12345abcde'
              mention: ['torgen']
            Promise.all [l, e, m]
            
          it 'fails when this did not feed that', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: '@torgen: this already didn\'t feed into even this poem.'
              useful: true
              mention: ['torgen']

          it 'fails when that does not exist', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: '@torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
              mention: ['torgen']

        describe 'that from this', ->
          it 'removes that', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            Messages.insert
              room_name: 'puzzles/fghij67890'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              body: '@torgen: OK, latino alphabet no longer feeds into this.'
              useful: true
              room_name: 'puzzles/fghij67890'
              mention: ['torgen']
            Promise.all [l, e, m]

          it 'fails when that did not feed this', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: '@torgen: latino alphabet already didn\'t feed into this.'
              useful: true
              mention: ['torgen']
              
          it 'fails when that does not exist', ->
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".'
              useful: true
              mention: ['torgen']

        describe 'that from the other', ->
          it 'removes that', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              body: '@torgen: OK, latino alphabet no longer feeds into even this poem.'
              useful: true
              room_name: 'puzzles/0000000000'
              mention: ['torgen']
            await Promise.all [l, e, m]
            chai.assert.deepInclude Puzzles.findOne('0000000000'),
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'

          it 'fails when that did not feed the other', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: '@torgen: latino alphabet already didn\'t feed into even this poem.'
              useful: true
              mention: ['torgen']

          it 'fails when that does not exist', ->
            Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".'
              useful: true
              mention: ['torgen']

          it 'fails when the other does not exist', ->
            Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: []
              touched: 2
              touched_by: 'cjb'
            Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: '@torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
              mention: ['torgen']

      describe 'in general room', ->
        it 'fails to remove this from that', ->
          Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot this #{verb} feed into even this poem"
          waitForDocument Messages, {nick: 'testbot', timestamp: 7},
            room_name: 'general/0'
            body: '@torgen: You need to tell me which puzzle this is for.'
            useful: true
            mention: ['torgen']

        it 'fails to remove that from this', ->
          Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot latino alphabet #{verb} feed into this"
          waitForDocument Messages, {nick: 'testbot', timestamp: 7},
            room_name: 'general/0'
            body: '@torgen: You need to tell me which puzzle this is for.'
            useful: true
            mention: ['torgen']

        it 'removes that from the other', ->
          Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot latino alphabet #{verb} feed into even this poem"
          l = waitForDocument Puzzles, {_id: '12345abcde', feedsInto: []},
            touched_by: 'torgen'
            touched: 7
          e = waitForDocument Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
            touched_by: 'torgen'
            touched: 7
          m = waitForDocument Messages, {nick: 'testbot', timestamp: 7},
            body: '@torgen: OK, latino alphabet no longer feeds into even this poem.'
            useful: true
            room_name: 'general/0'
            mention: ['torgen']
          Promise.all [l, e, m]