'use strict'

import settings from '/lib/imports/settings.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs, impersonating } from './impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'settings', ->
  clock = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 4
      toFake: ['Date']
    setting.ensure() for canon, setting of settings.all_settings
    clock.tick 3

  afterEach ->
    clock.restore()
  
  describe 'set', ->
    it 'fails without login', ->
      chai.assert.throws ->
        settings.EmbedPuzzles.set false
      , Match.Error

    it 'sets default', ->
      chai.assert.deepEqual settings.Settings.findOne('embed_puzzles'),
        _id: 'embed_puzzles'
        value: true
        touched: 4

    describe 'of boolean', ->
      [false, true].forEach (b) ->
        it "allows boolean #{b}", ->
          impersonating 'torgen', ->
            settings.EmbedPuzzles.set b
          chai.assert.deepEqual settings.Settings.findOne('embed_puzzles'),
            _id: 'embed_puzzles'
            value: b
            touched: 7
            touched_by: 'torgen'

        it "allows string #{b}", ->
          impersonating 'torgen', ->
            settings.EmbedPuzzles.set "#{b}"
          chai.assert.deepEqual settings.Settings.findOne('embed_puzzles'),
            _id: 'embed_puzzles'
            value: b
            touched: 7
            touched_by: 'torgen'

      it 'fails on non-boolean', ->
        chai.assert.throws ->
          impersonating 'torgen', ->
            settings.EmbedPuzzles.set 'something'
        , Match.Error

    describe 'of url', ->
      ['http', 'https'].forEach (protocol) ->
        it "allows protocol #{protocol}", ->
          url = "#{protocol}://molasses.holiday"
          impersonating 'torgen', ->
            settings.PuzzleUrlPrefix.set url
          chai.assert.deepEqual settings.Settings.findOne('puzzle_url_prefix'),
            _id: 'puzzle_url_prefix'
            value: url
            touched: 7
            touched_by: 'torgen'

      it 'disallows ftp', ->
        chai.assert.throws ->
          impersonating 'torgen', ->
            settings.PuzzleUrlPrefix.set 'ftp://log:pwd@molasses.holiday'
        , Match.Error
    
    describe 'of int', ->
      it 'allows integer', ->
        impersonating 'torgen', ->
          settings.MaximumMemeLength.set 925
        chai.assert.deepEqual settings.Settings.findOne('maximum_meme_length'),
          _id: 'maximum_meme_length'
          value: 925
          touched: 7
          touched_by: 'torgen'

      it 'allows string of integer', ->
        impersonating 'torgen', ->
          settings.MaximumMemeLength.set '633'
        chai.assert.deepEqual settings.Settings.findOne('maximum_meme_length'),
          _id: 'maximum_meme_length'
          value: 633
          touched: 7
          touched_by: 'torgen'

      it 'allows string of integral float', ->
        impersonating 'torgen', ->
          settings.MaximumMemeLength.set '286.99'
        chai.assert.deepEqual settings.Settings.findOne('maximum_meme_length'),
          _id: 'maximum_meme_length'
          value: 286
          touched: 7
          touched_by: 'torgen'
    
    describe 'of path component', ->
      uuid = '469a2d19-8a0C-4650-8621-7077a6de8ee6'
      it 'allows uuid', ->
        impersonating 'torgen', ->
          settings.StaticJitsiMeeting.set uuid
        chai.assert.deepEqual settings.Settings.findOne('static_jitsi_meeting'),
          _id: 'static_jitsi_meeting'
          value: uuid
          touched: 7
          touched_by: 'torgen'

      it 'canonicalizes', ->
        impersonating 'torgen', ->
          settings.StaticJitsiMeeting.set 'it\'s ya boy Voynich'
        chai.assert.deepEqual settings.Settings.findOne('static_jitsi_meeting'),
          _id: 'static_jitsi_meeting'
          value: 'its_ya_boy_voynich'
          touched: 7
          touched_by: 'torgen'

  
  describe 'get', ->
    it 'allows legacy values', ->
      # The old version used string as the value for all types, so if the
      # database has a string instead of a boolean, convert it.
      settings.Settings.upsert 'embed_puzzles',
        $set:
          value: 'false'
          touched: 4
          touched_by: 'cjb'
      chai.assert.isFalse settings.EmbedPuzzles.get()

  describe 'changeSetting method', ->
    it 'doesn\'t create setting', ->
      chai.assert.throws ->
        callAs 'changeSetting', 'torgen', 'foo', 'qux'
      , Match.Error
