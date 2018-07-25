'use strict'

# Will access contents via share
import './model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

model = share.model

describe 'puzzle method', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers(7)
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
    sinon.restore()

  beforeEach ->
    resetDatabase()

  describe 'newRoundGroup', ->
    it 'creates new round group', ->
      group = Meteor.call 'newRoundGroup',
        name: 'Foo'
        who: 'torgen'
        rounds: ['rd1']
      group = model.RoundGroups.findOne group._id
      chai.assert.deepInclude group,
        name: 'Foo'
        canon: 'foo'
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['rd1']
        incorrectAnswers: []
        tags: []
      chai.assert.doesNotHaveAnyKeys group, ['drive', 'spreadsheet', 'doc', 'link']
      chai.assert.lengthOf model.Messages.find({id: group._id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

    it 'returns existing group of same name', ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        tags: []
        solved: null
        solved_by: null
        incorrectAnswers: []
        rounds: ['rd1', 'rd2']
      group = Meteor.call 'newRoundGroup',
        name: 'Foo'
        who: 'cjb'
      chai.assert.equal group._id, id
      chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 0, 'oplogs'

  describe 'renameRoundGroup', ->
    it 'renames round group', ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['yoy']
        incorrectAnswers: []
        tags: []
      chai.assert.isTrue Meteor.call 'renameRoundGroup',
        id: id
        name: 'Bar'
        who: 'cjb'
      group = model.RoundGroups.findOne id
      chai.assert.include group,
        name: 'Bar'
        canon: 'bar'
        touched: 7
        touched_by: 'cjb'
      chai.assert.equal driveMethods.renamePuzzle.callCount, 0, 'rename drive calls'
      chai.assert.lengthOf model.Messages.find({id: id, type: 'roundgroups'}).fetch(), 1, 'oplogs'

    it 'doesn\'t clobber round group with same name', ->
      id1 = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        tags: []
      id2 = model.RoundGroups.insert
        name: 'Bar'
        canon: 'bar'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        incorrectAnswers: []
        tags: []
      chai.assert.isFalse Meteor.call 'renameRoundGroup',
        id: id1
        name: 'Bar'
        who: 'cjb'
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'roundgroups'}).fetch(), 0, 'oplogs'
  
  describe 'deleteRoundGroup', ->
    it 'deletes empty round group', ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: []
        incorrectAnswers: []
        tags: []
      chai.assert.isTrue Meteor.call 'deleteRoundGroup',
        id: id
        who: 'cjb'
      chai.assert.isUndefined model.RoundGroups.findOne(), 'no round groups after deletion'
      chai.assert.equal driveMethods.deletePuzzle.callCount, 0, 'delete drive calls'
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'roundgroups', room_name: 'oplog/0'}).fetch(), 1, 'oplogs'

    it 'doesn\'t delete non-empty round group', ->
      id = model.RoundGroups.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['foo1', 'foo2']
        incorrectAnswers: []
        tags: []
      chai.assert.isFalse Meteor.call 'deleteRoundGroup',
        id: id
        who: 'cjb'
      chai.assert.isNotNull model.RoundGroups.findOne id
      chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'

  describe 'newRound', ->
    it 'creates new round', ->
      round = Meteor.call 'newRound',
        name: 'Foo'
        who: 'torgen'
        link: 'https://puzzlehunt.mit.edu/foo'
        puzzles: ['yoy']
      # Round is created, then drive et al are added
      round = model.Rounds.findOne round._id
      chai.assert.deepInclude round,
        name: 'Foo'
        canon: 'foo'
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['yoy']
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      chai.assert.lengthOf model.Rounds.find(round._id).fetch(), 1, 'round created'
      chai.assert.lengthOf model.Messages.find({id: round._id, type: 'rounds'}).fetch(), 1, 'oplogs'

    it 'returns existing round of same name', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['yoy']
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      r = Meteor.call 'newRound',
        name: 'Foo'
        who: 'cjb'
      chai.assert.equal r._id, id
      chai.assert.include r,
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
      chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 0, 'oplogs'

  describe 'renameRound', ->
    it 'renames round', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['yoy']
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      chai.assert.isTrue Meteor.call 'renameRound',
        id: id
        name: 'Bar'
        who: 'cjb'
      round = model.Rounds.findOne id
      chai.assert.include round,
        name: 'Bar'
        canon: 'bar'
        touched: 7
        touched_by: 'cjb'
      chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']
      chai.assert.lengthOf model.Messages.find({id: id, type: 'rounds'}).fetch(), 1, 'oplogs'

    it 'doesn\'t clobber round with same name', ->
      id1 = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f1'
        spreadsheet: 's1'
        doc: 'd1'
        tags: []
      id2 = model.Rounds.insert
        name: 'Bar'
        canon: 'bar'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f2'
        spreadsheet: 's2'
        doc: 'd2'
        tags: []
      chai.assert.isFalse Meteor.call 'renameRound',
        id: id1
        name: 'Bar'
        who: 'cjb'
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'rounds'}).fetch(), 0, 'oplogs'
  
  describe 'deleteRound', ->
    it 'deletes empty round', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: []
        incorrectAnswers: []
        tags: []
        drive: 'ffoo'
        spreadsheet: 'sfoo'
        doc: 'dfoo'
      rgid = model.RoundGroups.insert
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: [id, 'another_round']
        incorrectAnswers: []
        tags: []
      chai.assert.isTrue Meteor.call 'deleteRound',
        id: id
        who: 'cjb'
      chai.assert.isUndefined model.Rounds.findOne(), 'no rounds after deletion'
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'rounds', room_name: 'oplog/0'}).fetch(), 1, 'oplogs'
      chai.assert.deepEqual model.RoundGroups.findOne(rgid),
        _id: rgid
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        # Removing round doesn't count as touching, apparently.
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        rounds: ['another_round']
        incorrectAnswers: []
        tags: []
      chai.assert.deepEqual driveMethods.deletePuzzle.getCall(0).args, ['ffoo', 'sfoo', 'dfoo']

    it 'doesn\'t delete non-empty round', ->
      id = model.Rounds.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['foo1', 'foo2']
        incorrectAnswers: []
        tags: []
      chai.assert.isFalse Meteor.call 'deleteRound',
        id: id
        who: 'cjb'
      chai.assert.isNotNull model.Rounds.findOne id
      chai.assert.lengthOf model.Messages.find(room_name: 'oplog/0').fetch(), 0, 'oplogs'
  
  describe 'newPuzzle', ->
    it 'creates puzzle', ->
      puzzle = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'torgen'
        link: 'https://puzzlehunt.mit.edu/foo'
      # Puzzle is created, then drive et al are added.
      puzzle = model.Puzzles.findOne puzzle._id
      chai.assert.deepInclude puzzle,
        name: 'Foo'
        canon: 'foo'
        created: 7
        created_by: 'torgen'
        touched: 7
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      chai.assert.lengthOf model.Puzzles.find(puzzle._id).fetch(), 1, 'puzzle created'
      chai.assert.lengthOf model.Messages.find({id: puzzle._id, type: 'puzzles'}).fetch(), 1, 'oplogs'
    
    it 'returns existing puzzle of same name', ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      p = Meteor.call 'newPuzzle',
        name: 'Foo'
        who: 'cjb'
      chai.assert.equal p._id, id
      chai.assert.include p,
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
      chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 0, 'oplogs'

  describe 'renamePuzzle', ->
    it 'renames puzzle', ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        doc: 'did'
        tags: []
      chai.assert.isTrue Meteor.call 'renamePuzzle',
        id: id
        name: 'Bar'
        who: 'cjb'
      puzzle = model.Puzzles.findOne id
      chai.assert.include puzzle,
        name: 'Bar'
        canon: 'bar'
        touched: 7
        touched_by: 'cjb'
      chai.assert.deepEqual driveMethods.renamePuzzle.getCall(0).args, ['Bar', 'fid', 'sid', 'did']
      chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1, 'oplogs'

    it 'doesn\'t clobber puzzle with same name', ->
      id1 = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f1'
        spreadsheet: 's1'
        doc: 'd1'
        tags: []
      id2 = model.Puzzles.insert
        name: 'Bar'
        canon: 'bar'
        created: 2
        created_by: 'cscott'
        touched: 2
        touched_by: 'cscott'
        solved: null
        solved_by: null
        incorrectAnswers: []
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'f2'
        spreadsheet: 's2'
        doc: 'd2'
        tags: []
      chai.assert.isFalse Meteor.call 'renamePuzzle',
        id: id1
        name: 'Bar'
        who: 'cjb'
      chai.assert.lengthOf model.Messages.find({id: {$in: [id1, id2]}, type: 'puzzles'}).fetch(), 0, 'oplogs'
  
  describe 'deletePuzzle', ->
    it 'deletes puzzle', ->
      id = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        incorrectAnswers: []
        tags: []
        drive: 'ffoo'
        spreadsheet: 'sfoo'
        doc: 'dfoo'
      rid = model.Rounds.insert
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: [id, 'another_puzzle']
        incorrectAnswers: []
        tags: []
      chai.assert.isTrue Meteor.call 'deletePuzzle',
        id: id
        who: 'cjb'
      chai.assert.isUndefined model.Puzzles.findOne(), 'no puzzles after deletion'
      chai.assert.lengthOf model.Messages.find({nick: 'cjb', type: 'puzzles', room_name: 'oplog/0'}).fetch(), 1, 'oplogs'
      chai.assert.deepEqual model.Rounds.findOne(rid),
        _id: rid
        name: 'Bar'
        canon: 'bar'
        created: 1
        created_by: 'torgen'
        # Removing puzzle doesn't count as touching, apparently.
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        puzzles: ['another_puzzle']
        incorrectAnswers: []
        tags: []
      chai.assert.deepEqual driveMethods.deletePuzzle.getCall(0).args, ['ffoo', 'sfoo', 'dfoo']
