'use strict'

import './000setup.coffee'  # for side effects
import './metas.coffee'  # for side effects
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '../imports/testutils.coffee'
import { impersonating } from '../imports/impersonate.coffee'

model = share.model

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
    robot = new Robot 'testbot'
    share.hubot.metas robot
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
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            waitForDocument model.Puzzles, {_id: '12345abcde', puzzles: []},
              touched: 7
              touched_by: 'torgen'

          it 'Fails when already meta', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: this was already a meta.'
              useful: true
              
          it 'can specify puzzle', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            await waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: []},
              touched: 7
              touched_by: 'torgen'
            chai.assert.isUndefined model.Puzzles.findOne('12345abcde').puzzles
              
          it 'fails when no such puzzle', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
            chai.assert.isUndefined model.Puzzles.findOne('12345abcde').puzzles

        describe 'in general room', ->
          it 'must specify puzzle', ->
            model.Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot #{before}this #{after} #{descriptor}"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              body: 'torgen: You need to tell me which puzzle this is for.'
              useful: true
              
          it 'can specify puzzle', ->
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot #{before}even this poem #{after} #{descriptor}"
            waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: []},
              touched: 7
              touched_by: 'torgen'

    ['isn\'t', 'is not'].forEach (verb) ->
      describe "it #{verb} a #{descriptor}", ->
        describe 'in puzzle room', ->
          it 'infers puzzle from this', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            waitForDocument model.Puzzles, {_id: '12345abcde', puzzles: null},
              touched: 7
              touched_by: 'torgen'

          it 'fails when it has a puzzle', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: ['a']
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: 1 puzzle feeds into Latino Alphabet. It must be a meta.'
              useful: true
            chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
              puzzles: ['a']

          it 'fails when it has multiple puzzles', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: ['a', 'b', 'c']
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: 3 puzzles feed into Latino Alphabet. It must be a meta.'
              useful: true
            chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
              puzzles: ['a', 'b', 'c']

          it 'fails when not meta', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: this already wasn\'t a meta.'
              useful: true

          it 'can specify puzzle', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            await waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: null},
              touched: 7
              touched_by: 'torgen'
            chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
              puzzles: []

          it 'fails when no such puzzle', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
              puzzles: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              body: 'torgen: I can\'t find a puzzle called "even this poem".'
              useful: true
            chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
              puzzles: []

        describe 'in general room', ->
          it 'must specify puzzle', ->
            model.Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot this #{verb} a #{descriptor}"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'general/0'
              body: 'torgen: You need to tell me which puzzle this is for.'
              useful: true

          it 'can specify puzzle', ->
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: []
            model.Messages.insert
              nick: 'torgen'
              room_name: 'general/0'
              timestamp: 7
              body: "bot even this poem #{verb} a #{descriptor}"
            waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: null},
              touched: 7
              touched_by: 'torgen'

  describe 'feeds into', ->
    describe 'in puzzle room', ->
      it 'feeds this into that', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        model.Messages.insert
          room_name: 'puzzles/12345abcde'
          timestamp: 7
          nick: 'torgen'
          body: 'bot this feeds into even this poem'
        l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        Promise.all [l, e]

      it 'feeds that into this', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        model.Messages.insert
          room_name: 'puzzles/fghij67890'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into this'
        l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        Promise.all [l, e]

      it 'feeds that into the other', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        model.Puzzles.insert
          _id: '0000000000'
          name: 'A Third Thing'
          canon: 'a_third_thing'
          feedsInto: []
        model.Messages.insert
          room_name: 'puzzles/0000000000'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into even this poem'
        l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        await Promise.all [l, e]
        chai.assert.deepInclude model.Puzzles.findOne('0000000000'),
          feedsInto: []
        chai.assert.isUndefined model.Puzzles.findOne('0000000000').puzzles

    describe 'in general room', ->
      it 'fails to feed this into that', ->
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        model.Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot this feeds into even this poem'
        await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'general/0'
          body: 'torgen: You need to tell me which puzzle this is for.'
          useful: true
        chai.assert.isUndefined model.Puzzles.findOne('fghij67890').puzzles

      it 'fails to feed that into this', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
          touched: 2
          touched_by: 'cjb'
        model.Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into this'
        await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          room_name: 'general/0'
          body: 'torgen: You need to tell me which puzzle this is for.'
          useful: true
        chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
          feedsInto: []
          touched: 2
          touched_by: 'cjb'

      it 'feeds that into the other', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          feedsInto: []
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          feedsInto: []
        model.Messages.insert
          room_name: 'general/0'
          timestamp: 7
          nick: 'torgen'
          body: 'bot latino alphabet feeds into even this poem'
        l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: 'fghij67890'},
          touched_by: 'torgen'
          touched: 7
        e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: '12345abcde'},
          touched_by: 'torgen'
          touched: 7
        Promise.all [l, e]

  ['doesn\'t', 'does not'].forEach (verb) ->
    describe "#{verb} feed into", ->
      describe 'in puzzle room', ->
        describe 'this from that', ->
          it 'removes this', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            model.Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            Promise.all [l, e]
            
          it 'fails when this did not feed that', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            model.Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: 'torgen: this already didn\'t feed into even this poem.'
              useful: true

          it 'fails when that does not exist', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot this #{verb} feed into even this poem"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: 'torgen: I can\'t find a puzzle called "even this poem".'
              useful: true

        describe 'that from this', ->
          it 'removes that', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            model.Messages.insert
              room_name: 'puzzles/fghij67890'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            Promise.all [l, e]

          it 'fails when that did not feed this', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            model.Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: 'torgen: latino alphabet already didn\'t feed into this.'
              useful: true
              
          it 'fails when that does not exist', ->
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            model.Messages.insert
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into this"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/12345abcde'
              timestamp: 7
              body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
              useful: true

        describe 'that from the other', ->
          it 'removes that', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: ['fghij67890']
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['12345abcde', '0000000000']
            model.Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            model.Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: []},
              touched_by: 'torgen'
              touched: 7
            e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
              touched_by: 'torgen'
              touched: 7
            await Promise.all [l, e]
            chai.assert.deepInclude model.Puzzles.findOne('0000000000'),
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'

          it 'fails when that did not feed the other', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            model.Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            model.Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: 'torgen: latino alphabet already didn\'t feed into even this poem.'
              useful: true

          it 'fails when that does not exist', ->
            model.Puzzles.insert
              _id: 'fghij67890'
              name: 'Even This Poem'
              canon: 'even_this_poem'
              feedsInto: []
              puzzles: ['0000000000']
            model.Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: ['fghij67890']
              touched: 2
              touched_by: 'cjb'
            model.Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
              useful: true

          it 'fails when the other does not exist', ->
            model.Puzzles.insert
              _id: '12345abcde'
              name: 'Latino Alphabet'
              canon: 'latino_alphabet'
              feedsInto: []
            model.Puzzles.insert
              _id: '0000000000'
              name: 'A Third Thing'
              canon: 'a_third_thing'
              feedsInto: []
              touched: 2
              touched_by: 'cjb'
            model.Messages.insert
              room_name: 'puzzles/0000000000'
              timestamp: 7
              nick: 'torgen'
              body: "bot latino alphabet #{verb} feed into even this poem"
            waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
              room_name: 'puzzles/0000000000'
              timestamp: 7
              body: 'torgen: I can\'t find a puzzle called "even this poem".'
              useful: true

      describe 'in general room', ->
        it 'fails to remove this from that', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          model.Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          model.Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot this #{verb} feed into even this poem"
          waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            room_name: 'general/0'
            body: 'torgen: You need to tell me which puzzle this is for.'
            useful: true

        it 'fails to remove that from this', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          model.Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          model.Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot latino alphabet #{verb} feed into this"
          waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            room_name: 'general/0'
            body: 'torgen: You need to tell me which puzzle this is for.'
            useful: true

        it 'removes that from the other', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: ['fghij67890']
          model.Puzzles.insert
            _id: 'fghij67890'
            name: 'Even This Poem'
            canon: 'even_this_poem'
            feedsInto: []
            puzzles: ['12345abcde', '0000000000']
          model.Messages.insert
            room_name: 'general/0'
            timestamp: 7
            nick: 'torgen'
            body: "bot latino alphabet #{verb} feed into even this poem"
          l = waitForDocument model.Puzzles, {_id: '12345abcde', feedsInto: []},
            touched_by: 'torgen'
            touched: 7
          e = waitForDocument model.Puzzles, {_id: 'fghij67890', puzzles: ['0000000000']},
            touched_by: 'torgen'
            touched: 7
          Promise.all [l, e]