'use strict'

import './000setup.coffee'  # for side effects
import './codex.coffee'  # for side effects
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '../imports/testutils.coffee'
import { all_settings, EmbedPuzzles, MaximumMemeLength, PuzzleUrlPrefix, RoundUrlPrefix } from '/lib/imports/settings.coffee'
import { impersonating } from '../imports/impersonate.coffee'

model = share.model

describe 'codex hubot script', ->
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
    share.hubot.codex robot
    robot.run()
    clock.tick 1
    driveMethods =
      createPuzzle: sinon.fake.returns
        id: 'fid' # f for folder
        spreadId: 'sid'
        docId: 'did'
      renamePuzzle: sinon.spy()
      deletePuzzle: sinon.spy()
    if share.drive?
      sinon.stub(share, 'drive').value(driveMethods)
    else
      share.drive = driveMethods

  afterEach ->
    robot.shutdown()
    clock.restore()
    sinon.restore()

  describe 'setAnswer', ->
    it 'fails when puzzle does not exist', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'puzzles/12345abcde'
        timestamp: Date.now()
        body: 'bot the answer to latino alphabet is linear abeja'
      waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
        body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
        room_name: 'puzzles/12345abcde'
        useful: true

    it 'sets answer', ->
      model.Puzzles.insert
        _id: '12345abcde'
        name: 'Latino Alphabet'
        canon: 'latino_alphabet'
        feedsInto: []
        tags: {}
      model.Messages.insert
        nick: 'torgen'
        room_name: 'puzzles/12345abcde'
        timestamp: Date.now()
        body: 'bot the answer to latino alphabet is linear abeja'
      waitForDocument model.Puzzles, {_id: '12345abcde', solved_by: 'torgen'},
        touched: 7
        touched_by: 'torgen'
        solved: 7
        tags: answer:
          name: 'Answer'
          value: 'linear abeja'
          touched: 7
          touched_by: 'torgen'

    it 'overwrites answer', ->
      model.Puzzles.insert
        _id: '12345abcde'
        name: 'Latino Alphabet'
        canon: 'latino_alphabet'
        feedsInto: []
        touched: 3
        touched_by: 'cjb'
        solved: 3
        solved_by: 'cjb'
        tags:
          answer:
            name: 'Answer'
            value: 'vasco de gamma'
            touched: 3
            touched_by: 'cjb'
      model.Messages.insert
        nick: 'torgen'
        room_name: 'puzzles/12345abcde'
        timestamp: Date.now()
        body: 'bot the answer to latino alphabet is linear abeja'
      waitForDocument model.Puzzles, {_id: '12345abcde', solved_by: 'torgen'},
        touched: 7
        touched_by: 'torgen'
        solved: 7
        tags: answer:
          name: 'Answer'
          value: 'linear abeja'
          touched: 7
          touched_by: 'torgen'

    it 'leaves old answer', ->
      model.Puzzles.insert
        _id: '12345abcde'
        name: 'Latino Alphabet'
        canon: 'latino_alphabet'
        feedsInto: []
        solved: 3
        solved_by: 'cjb'
        touched: 3
        touched_by: 'cjb'
        tags:
          answer:
            name: 'Answer'
            value: 'linear abeja'
            touched: 3
            touched_by: 'cjb'
      model.Messages.insert
        nick: 'torgen'
        room_name: 'puzzles/12345abcde'
        timestamp: Date.now()
        body: 'bot the answer to latino alphabet is linear abeja'
      await waitForDocument model.Messages, {nick: 'testbot', body: /^torgen:/},
        timestamp: 7
        useful: true
        room_name: 'puzzles/12345abcde'
      chai.assert.deepInclude model.Puzzles.findOne(_id: '12345abcde'),
        touched: 3
        touched_by: 'cjb'
        solved: 3
        solved_by: 'cjb'
        tags: answer:
          name: 'Answer'
          value: 'linear abeja'
          touched: 3
          touched_by: 'cjb'

  describe 'deleteAnswer', ->
    it 'deletes answer', ->
      model.Puzzles.insert
        _id: '12345abcde'
        name: 'Latino Alphabet'
        canon: 'latino_alphabet'
        feedsInto: []
        touched: 3
        touched_by: 'cjb'
        solved: 3
        solved_by: 'cjb'
        tags:
          answer:
            name: 'Answer'
            value: 'vasco de gamma'
            touched: 3
            touched_by: 'cjb'
      model.Messages.insert
        nick: 'torgen'
        room_name: 'puzzles/fghij67890'
        timestamp: Date.now()
        body: 'bot delete answer for latino alphabet'
      waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.answer': $exists: false},
        touched: 7
        touched_by: 'torgen'

    it 'fails when no such puzzle exists', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot delete answer for latino alphabet'
      waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
        body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
        room_name: 'general/0'
        useful: true

  describe 'newCallIn', ->
    describe 'of answer', ->
      describe 'in puzzle room', ->
        it 'infers puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot call in linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'answer'

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/fghij67890'
            timestamp: Date.now()
            body: 'bot call in linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'answer'

        it 'understands backsolved', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot call in backsolved linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            backsolve: true
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'answer'

        it 'understands provided', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot call in provided linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            provided: true
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'answer'

      describe 'in general room', ->
        it 'fails when puzzle is not specified', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot call in linear abeja'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: You need to tell me which puzzle this is for.'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'fails when puzzle does not exist', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot call in linear abeja for latino alphabet'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot call in linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'answer'

    describe 'of interaction request', ->
      describe 'in puzzle room', ->
        it 'infers puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot request interaction linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'interaction request'

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/fghij67890'
            timestamp: Date.now()
            body: 'bot request interaction linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'interaction request'

      describe 'in general room', ->
        it 'fails when puzzle is not specified', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot request interaction linear abeja'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: You need to tell me which puzzle this is for.'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'fails when puzzle does not exist', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot request interaction linear abeja for latino alphabet'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot request interaction linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'interaction request'

    describe 'of message to hq', ->
      describe 'in puzzle room', ->
        it 'infers puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot tell HQ linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'message to hq'

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/fghij67890'
            timestamp: Date.now()
            body: 'bot tell HQ linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'message to hq'

      describe 'in general room', ->
        it 'fails when puzzle is not specified', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot tell HQ linear abeja'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: You need to tell me which puzzle this is for.'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'fails when puzzle does not exist', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot tell HQ linear abeja for latino alphabet'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot tell HQ linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'message to hq'

    describe 'of expected callback', ->
      describe 'in puzzle room', ->
        it 'infers puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/12345abcde'
            timestamp: Date.now()
            body: 'bot expect  callback linear abeja'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'expected callback'

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'puzzles/fghij67890'
            timestamp: Date.now()
            body: 'bot expect callback linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'expected callback'

      describe 'in general room', ->
        it 'fails when puzzle is not specified', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot expect callback linear abeja'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: You need to tell me which puzzle this is for.'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'fails when puzzle does not exist', ->
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot expect callback linear abeja for latino alphabet'
          await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
            body: 'torgen: I can\'t find a puzzle called "latino alphabet".'
            room_name: 'general/0'
            useful: true
          chai.assert.isUndefined model.CallIns.findOne()

        it 'allows specifying puzzle', ->
          model.Puzzles.insert
            _id: '12345abcde'
            name: 'Latino Alphabet'
            canon: 'latino_alphabet'
            feedsInto: []
            tags: {}
          model.Messages.insert
            nick: 'torgen'
            room_name: 'general/0'
            timestamp: Date.now()
            body: 'bot expect callback linear abeja for latino alphabet'
          waitForDocument model.CallIns, {answer: 'linear abeja'},
            target: '12345abcde'
            created: 7
            created_by: 'torgen'
            touched: 7
            touched_by: 'torgen'
            callin_type: 'expected callback'

  describe 'newPuzzle', ->
    beforeEach -> PuzzleUrlPrefix.ensure()

    it 'creates in named meta', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in even this poem'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet'},
        canon: 'latino_alphabet'
        feedsInto: [mid]
      await waitForDocument model.Puzzles, {_id: mid, puzzles: puzz._id}, {}
      await waitForDocument model.Rounds, {_id: rid, puzzles: [mid, puzz._id]}, {}

    it 'creates in this meta', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: "puzzles/#{mid}"
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in this'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet'},
        canon: 'latino_alphabet'
        feedsInto: [mid]
      await waitForDocument model.Puzzles, {_id: mid, puzzles: puzz._id}, {}

    it 'creates in named round', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
        puzzles: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in elliptic curve'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet'},
        canon: 'latino_alphabet'
        feedsInto: []
      await waitForDocument model.Rounds, {_id: rid, puzzles: [mid, puzz._id]}, {}
      chai.assert.deepInclude model.Puzzles.findOne(mid), puzzles: []

    it 'creates in this round', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
        puzzles: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: "rounds/#{rid}"
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in this'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet', puzzles: null},
        canon: 'latino_alphabet'
        feedsInto: []
      await waitForDocument model.Rounds, {_id: rid, puzzles: [mid, puzz._id]}, {}
      chai.assert.deepInclude model.Puzzles.findOne(mid), puzzles: []

    it 'creates meta in this round', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
        puzzles: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: "rounds/#{rid}"
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new meta in this'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet'},
        canon: 'latino_alphabet'
        feedsInto: []
        puzzles: []
      await waitForDocument model.Rounds, {_id: rid, puzzles: [mid, puzz._id]}, {}
      chai.assert.deepInclude model.Puzzles.findOne(mid), puzzles: []

    it 'fails when this is not a puzzle or round', ->
      mid = model.Puzzles.insert
        name: 'Even This Poem'
        canon: 'even_this_poem'
        feedsInto: []
        puzzles: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: [mid]
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in this'
      await waitForDocument model.Messages, {body: 'torgen: You need to tell me which puzzle this is for.'},
        nick: 'testbot'
        timestamp: 7
        room_name: 'general/0'
        useful: true
      chai.assert.deepInclude model.Puzzles.findOne(mid), puzzles: []
      chai.assert.deepInclude model.Rounds.findOne(rid), puzzles: [mid]

    it 'allows specifying type to create in', ->
      mid = model.Puzzles.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        feedsInto: []
        puzzles: []
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: []
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in round elliptic curve'
      puzz = await waitForDocument model.Puzzles, {name: 'Latino Alphabet'},
        canon: 'latino_alphabet'
        feedsInto: []
      await waitForDocument model.Rounds, {_id: rid, puzzles: [puzz._id]}, {}
      chai.assert.deepInclude model.Puzzles.findOne(mid), puzzles: []

    it 'fails when no such thing to create in', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Latino Alphabet is a new puzzle in elliptic curve'
      waitForDocument model.Messages, {body: 'torgen: I can\'t find anything called "elliptic curve".'},
        nick: 'testbot'
        timestamp: 7
        room_name: 'general/0'
        useful: true

  describe 'deletePuzzle', ->
    it 'deletes puzzle', ->
      pid = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        feedsInto: []
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot delete puzzle foo'
      await waitForDocument model.Messages, { body: 'torgen: Okay, I deleted "Foo".' },
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true
      chai.assert.isUndefined model.Puzzles.findOne _id: pid

    it 'fails when puzzle does not exist', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot delete puzzle foo'
      waitForDocument model.Messages, { body: 'torgen: I can\'t find a puzzle called "foo".' },
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true

  describe 'newRound', ->
    it 'creates round', ->
      RoundUrlPrefix.ensure()
      impersonating 'testbot', -> RoundUrlPrefix.set 'https://moliday.holasses/round'
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot Elliptic Curve is a new round'
      waitForDocument model.Rounds, { name: 'Elliptic Curve' },
        canon: 'elliptic_curve'
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        puzzles: []
        sort_key: 7
        link: 'https://moliday.holasses/round/elliptic_curve'

  describe 'deleteRound', ->
    it 'deletes empty round', ->
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: []
      model.Messages.insert
        nick: 'torgen'
        room_name: 'callins/0'
        timestamp: Date.now()
        body: 'bot delete round elliptic curve'
      await waitForDocument model.Messages, { body: 'torgen: Okay, I deleted round "Elliptic Curve".' },
        nick: 'testbot'
        timestamp: 7
        room_name: 'callins/0'
        useful: true
      chai.assert.isUndefined model.Rounds.findOne _id: rid

    it 'fails when round contains puzzles', ->
      rid = model.Rounds.insert
        name: 'Elliptic Curve'
        canon: 'elliptic_curve'
        puzzles: ['1']
      model.Messages.insert
        nick: 'torgen'
        room_name: 'callins/0'
        timestamp: Date.now()
        body: 'bot delete round elliptic curve'
      await waitForDocument model.Messages, { body: 'torgen: Couldn\'t delete round. (Are there still puzzles in it?)' },
        nick: 'testbot'
        timestamp: 7
        room_name: 'callins/0'
        useful: true
      chai.assert.isObject model.Rounds.findOne _id: rid

    it 'fails when round does not exist', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'callins/0'
        timestamp: Date.now()
        body: 'bot delete round elliptic curve'
      waitForDocument model.Messages, { body: 'torgen: I can\'t find a round called "elliptic curve".' },
        nick: 'testbot'
        timestamp: 7
        room_name: 'callins/0'
        useful: true

  describe 'newQuip', ->
    it 'adds quip', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot new quip Codex is my co-dump stat'
      waitForDocument model.Quips, { text: 'Codex is my co-dump stat' },
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        name: 'Garth Shelkoff'  # from a hash of the text, so it's consistent.
        last_used: 0
        use_count: 0

  describe 'setTag', ->
    describe 'in puzzle room', ->
      it 'infers puzzle', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot set Color to blue'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

      it 'allows specifying puzzle', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/fghij67890'
          timestamp: Date.now()
          body: 'bot set Color for latino alphabet to blue'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

      it 'allows specifying round', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Rounds.insert
          _id: 'fghij67890'
          name: 'Elliptic Curve'
          canon: 'elliptic_curve'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot set Color for elliptic curve to blue'
        waitForDocument model.Rounds, {_id: 'fghij67890', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'
            
    describe 'in round room', ->
      it 'infers round', ->
        model.Rounds.insert
          _id: 'fghij67890'
          name: 'Elliptic Curve'
          canon: 'elliptic_curve'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'rounds/fghij67890'
          timestamp: Date.now()
          body: 'bot set Color to blue'
        waitForDocument model.Rounds, {_id: 'fghij67890', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'
            
      it 'allows specifying puzzle', ->
        model.Rounds.insert
          _id: 'fghij67890'
          name: 'Elliptic Curve'
          canon: 'elliptic_curve'
          tags: {}
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'rounds/fghij67890'
          timestamp: Date.now()
          body: 'bot set Color for latino alphabet to blue'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

      it 'allows specifying round', ->
        model.Rounds.insert
          _id: 'fghij67890'
          name: 'Elliptic Curve'
          canon: 'elliptic_curve'
          tags: {}
        model.Rounds.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'rounds/fghij67890'
          timestamp: Date.now()
          body: 'bot set Color of latino alphabet to blue'
        waitForDocument model.Rounds, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

    describe 'in general room', ->
      it 'fails when target is not specified', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot set Color to blue'
        waitForDocument model.Messages, {body: 'torgen: You need to tell me which puzzle this is for.'},
          nick: 'testbot'
          room_name: 'general/0'
          timestamp: 7

      it 'fails when target does not exist', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot set Color for latino alphabet to blue'
        waitForDocument model.Messages, {body: 'torgen: I can\'t find anything called "latino alphabet".'},
          nick: 'testbot'
          room_name: 'general/0'
          timestamp: 7

      it 'allows specifying puzzle', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot set Color for latino alphabet to blue'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

      it 'allows specifying round', ->
        model.Rounds.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot set Color for latino alphabet to blue'
        waitForDocument model.Rounds, {_id: '12345abcde', 'tags.color.value': 'blue' },
          tags: color:
            name: 'Color'
            touched_by: 'torgen'
            touched: 7
            value: 'blue'

  describe 'stuck', ->
    describe 'in puzzle room', ->
      it 'marks stuck without reason', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot stuck'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.status.value': 'Stuck' },
          tags: status:
            name: 'Status'
            touched_by: 'torgen'
            touched: 7
            value: 'Stuck'

      it 'marks stuck with reason', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot stuck because maparium is closed'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.status.value': 'Stuck: maparium is closed' },
          tags: status:
            name: 'Status'
            touched_by: 'torgen'
            touched: 7
            value: 'Stuck: maparium is closed'

      it 'allows specifying puzzle', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot stuck on even this poem because maparium is closed'
        waitForDocument model.Puzzles, {_id: 'fghij67890', 'tags.status.value': 'Stuck: maparium is closed' },
          tags: status:
            name: 'Status'
            touched_by: 'torgen'
            touched: 7
            value: 'Stuck: maparium is closed'
            
    describe 'in general room', ->
      it 'marks stuck without reason', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot stuck on latino alphabet'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.status.value': 'Stuck' },
          tags: status:
            name: 'Status'
            touched_by: 'torgen'
            touched: 7
            value: 'Stuck'

      it 'marks stuck with reason', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot stuck on latino alphabet because maparium is closed'
        waitForDocument model.Puzzles, {_id: '12345abcde', 'tags.status.value': 'Stuck: maparium is closed' },
          tags: status:
            name: 'Status'
            touched_by: 'torgen'
            touched: 7
            value: 'Stuck: maparium is closed'

      it 'fails without puzzle', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot stuck because maparium is closed'
        waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: You need to tell me which puzzle this is for.'
          room_name: 'general/0'
          useful: true

      it 'fails on round', ->
        model.Rounds.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot stuck on latino alphabet because maparium is closed'
        await waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: I don\'t know what "latino alphabet" is.'
          room_name: 'general/0'
          useful: true
        chai.assert.deepInclude model.Rounds.findOne('12345abcde'),
          tags: {}

    describe 'in round room', ->
      it 'fails without puzzle', ->
        model.Rounds.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'rounds/12345abcde'
          timestamp: Date.now()
          body: 'bot stuck because maparium is closed'
        waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: Only puzzles can be stuck.'
          room_name: 'rounds/12345abcde'
          useful: true

  describe 'unstuck', ->
    describe 'in puzzle room', ->
      it 'marks unstuck', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags:
            status:
              name: 'Status'
              value: 'Stuck'
              touched: 6
              touched_by: 'torgen'
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot unstuck'
        await waitForDocument model.Messages, {nick: 'torgen', room_name: 'puzzles/12345abcde', action: true},
          body: 'no longer needs help getting unstuck'
          timestamp: 7
        chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
          tags: {}
        
      it 'is here to help', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags:
            status:
              name: 'Status'
              value: 'Stuck'
              touched: 6
              touched_by: 'cjb'
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/12345abcde'
          timestamp: Date.now()
          body: 'bot unstuck'
        await waitForDocument model.Messages, {nick: 'torgen', room_name: 'puzzles/12345abcde', action: true},
          body: 'has arrived to help'
          timestamp: 7
        chai.assert.deepInclude model.Puzzles.findOne('12345abcde'),
          tags: {}

      it 'allows specifying puzzle', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags:
            status:
              name: 'Status'
              value: 'Stuck'
              touched: 6
              touched_by: 'cjb'
        model.Puzzles.insert
          _id: 'fghij67890'
          name: 'Even This Poem'
          canon: 'even_this_poem'
          tags: {}
        model.Messages.insert
          nick: 'torgen'
          room_name: 'puzzles/fghij67890'
          timestamp: Date.now()
          body: 'bot unstuck on latino alphabet'
        waitForDocument model.Puzzles, {_id: '12345abcde', tags: {}},
          touched: 7
          touched_by: 'torgen'

    describe 'in general room', ->
      it 'marks unstuck', ->
        model.Puzzles.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags:
            status:
              name: 'Status'
              value: 'Stuck'
              touched: 6
              touched_by: 'cjb'
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot unstuck on latino alphabet'
        waitForDocument model.Puzzles, {_id: '12345abcde', tags: {}},
          touched: 7
          touched_by: 'torgen'

      it 'fails without puzzle', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot unstuck'
        waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: You need to tell me which puzzle this is for.'
          room_name: 'general/0'
          useful: true

      it 'fails when no such puzzle', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot unstuck on latino alphabet'
        waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: I don\'t know what "latino alphabet" is.'
          room_name: 'general/0'
          useful: true

    describe 'in round room', ->
      it 'fails without puzzle', ->
        model.Rounds.insert
          _id: '12345abcde'
          name: 'Latino Alphabet'
          canon: 'latino_alphabet'
          tags:
            status:
              name: 'Status'
              value: 'Stuck'
              touched: 6
              touched_by: 'cjb'
        model.Messages.insert
          nick: 'torgen'
          room_name: 'rounds/12345abcde'
          timestamp: Date.now()
          body: 'bot unstuck'
        waitForDocument model.Messages, {nick: 'testbot', timestamp: 7},
          body: 'torgen: Only puzzles can be stuck.'
          room_name: 'rounds/12345abcde'
          useful: true

  describe 'announce', ->
    it 'creates announcement', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot announce Oops was brought to you by erasers'
      waitForDocument model.Messages, {room_name: 'oplog/0', stream: 'announcements'},
        nick: 'torgen'
        oplog: true
        action: true
        body: 'Announcement: Oops was brought to you by erasers'

  describe 'poll', ->
    it 'creates poll', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot poll "Who you got?" us "the field"'
      poll = await waitForDocument model.Polls, {},
        question: 'Who you got?'
        created: 7
        created_by: 'torgen'
        options: [
          { canon: 'us', option: 'us'}
          { canon: 'the_field', option: 'the field' }
        ]
        votes: {}
      await waitForDocument model.Messages, {poll: poll._id},
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: 7

    it 'requires two options', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot poll "Vote for me!" OK'
      waitForDocument model.Messages, {body: 'torgen: Must have between 2 and 5 options.' },
        nick: 'testbot'
        timestamp: 7
        room_name: 'general/0'
        useful: true

    it 'forbids more than five options', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot poll "Best dwarf" Grumpy Happy Sleepy Sneezy Dopey Bashful Doc'
      waitForDocument model.Messages, {body: 'torgen: Must have between 2 and 5 options.' },
        nick: 'testbot'
        timestamp: 7
        room_name: 'general/0'
        useful: true
  
  describe 'global list', ->
    it 'lists global settings', ->
      v.ensure() for k, v of all_settings
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot global list'
      for k, v of all_settings
        await waitForDocument model.Messages, {nick: 'testbot', to: 'torgen', body: new RegExp "^#{v.name}:"},
          room_name: 'general/0'
          timestamp: 7
          useful: true
  
  describe 'global set', ->
    beforeEach -> v.ensure() for k, v of all_settings

    it 'sets number', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot global set maximum meme length to 97'
      await waitForDocument model.Messages, {body: 'torgen: OK, set maximum meme length to 97'},
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true
      chai.assert.equal 97, MaximumMemeLength.get()

    it 'sets boolean', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot global set embed puzzles to false'
      await waitForDocument model.Messages, {body: 'torgen: OK, set embed puzzles to false'},
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true
      chai.assert.isFalse EmbedPuzzles.get()

    it 'sets url', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot global set round url prefix to https://moliday.holasses/round'
      await waitForDocument model.Messages, {body: 'torgen: OK, set round url prefix to https://moliday.holasses/round'},
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true
      chai.assert.equal 'https://moliday.holasses/round', RoundUrlPrefix.get()

    it 'fails when setting does not exist', ->
      model.Messages.insert
        nick: 'torgen'
        room_name: 'general/0'
        timestamp: Date.now()
        body: 'bot global set background color to black'
      waitForDocument model.Messages, {body: 'torgen: Sorry, I don\'t know the setting \'background color\'.'},
        nick: 'testbot'
        room_name: 'general/0'
        timestamp: 7
        useful: true

    describe 'when value has wrong format for setting', ->
      it 'fails for boolean', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot global set embed puzzles to maybe'
        await waitForDocument model.Messages, {body: /^torgen: Sorry, there was an error:/},
          nick: 'testbot'
          room_name: 'general/0'
          timestamp: 7
          useful: true
        chai.assert.isTrue EmbedPuzzles.get()

      it 'fails for url', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot global set round url prefix to twelve'
        await waitForDocument model.Messages, {body: /^torgen: Sorry, there was an error:/},
          nick: 'testbot'
          room_name: 'general/0'
          timestamp: 7
          useful: true
        chai.assert.equal '', RoundUrlPrefix.get()

      it 'fails for number', ->
        model.Messages.insert
          nick: 'torgen'
          room_name: 'general/0'
          timestamp: Date.now()
          body: 'bot global set maximum meme length to twelve'
        await waitForDocument model.Messages, {body: /^torgen: Sorry, there was an error:/},
          nick: 'testbot'
          room_name: 'general/0'
          timestamp: 7
          useful: true
        chai.assert.equal 140, MaximumMemeLength.get()
