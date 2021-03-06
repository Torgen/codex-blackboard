'use strict'

import {waitForMethods, waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'blackboard', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  it 'sorts rounds in requested order', ->
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    # there should be table headers for the two rounds, in the right order.
    civ = share.model.Rounds.findOne name: 'Civilization'
    chai.assert.isDefined $("#round#{civ._id}").html()
    emo = share.model.Rounds.findOne name: 'Emotions and Memories'
    chai.assert.isDefined $("#round#{emo._id}").html()
    chai.assert.isBelow $("#round#{civ._id}").offset().top, $("#round#{emo._id}").offset().top
    $('button[data-sortReverse="true"]').click()
    await afterFlushPromise()
    chai.assert.isAbove $("#round#{civ._id}").offset().top, $("#round#{emo._id}").offset().top
    $('button[data-sortReverse="false"]').click()
    await afterFlushPromise()
    chai.assert.isBelow $("#round#{civ._id}").offset().top, $("#round#{emo._id}").offset().top

  describe 'in edit mode', ->

    it 'allows reordering puzzles', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      # there should be a table header for the Civilization round.
      wall_street = share.model.Puzzles.findOne name: 'Wall Street'
      maths = share.model.Puzzles.findOne name: 'Advanced Maths'
      cheaters = share.model.Puzzles.findOne name: 'Cheaters Never Prosper'
      mathsJQ = $ "#m#{wall_street._id} tr[data-puzzle-id=\"#{maths._id}\"]"
      cheatersJQ = $ "#m#{wall_street._id} tr[data-puzzle-id=\"#{cheaters._id}\"]"
      chai.assert.isBelow mathsJQ.offset().top, cheatersJQ.offset().top, 'before reorder'
      mathsJQ.find('button.bb-move-down').click()
      await waitForSubscriptions()
      await afterFlushPromise()
      chai.assert.isAbove mathsJQ.offset().top, cheatersJQ.offset().top, 'after down'
      mathsJQ.find('button.bb-move-up').click()
      await waitForSubscriptions()
      await afterFlushPromise()
      chai.assert.isBelow mathsJQ.offset().top, cheatersJQ.offset().top, 'after up'

    it 'alphabetizes within a meta', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      # there should be a table header for the Civilization round.
      disgust = share.model.Puzzles.findOne name: 'Disgust'
      clueless = share.model.Puzzles.findOne name: 'Clueless'
      aka = share.model.Puzzles.findOne name: 'AKA'
      disgustJQ = $ "#m#{disgust._id}"
      cluelessJQ =  disgustJQ.find "tr[data-puzzle-id=\"#{clueless._id}\"]"
      akaJQ = disgustJQ.find "tr[data-puzzle-id=\"#{aka._id}\"]"
      chai.assert.isBelow cluelessJQ.offset().top, akaJQ.offset().top, 'before reorder'
      disgustJQ.find('button[data-sort-order="name"]').click()
      await waitForSubscriptions()
      await afterFlushPromise()
      chai.assert.isAbove cluelessJQ.offset().top, akaJQ.offset().top, 'after alpha'
      disgustJQ.find('button[data-sort-order=""]').click()
      await waitForSubscriptions()
      await afterFlushPromise()
      chai.assert.isBelow cluelessJQ.offset().top, akaJQ.offset().top, 'after manual'

  it 'makes a puzzle a favorite', ->
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isUndefined $('#favorites').html()
    # there should be a table header for the Civilization round.
    granary = share.model.Puzzles.findOne name: 'Granary Of Ur'
    bank = share.model.Puzzles.findOne name: 'Letter Bank'
    chai.assert.isDefined $("#m#{granary._id} tr[data-puzzle-id=\"#{bank._id}\"] .bb-favorite-button").html()
    $("#m#{granary._id} tr[data-puzzle-id=\"#{bank._id}\"] .bb-favorite-button").click()
    await waitForMethods()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isDefined $('#favorites').html()
    chai.assert.isDefined $("tr[data-puzzle-id=\"#{bank._id}\"] .bb-recent-puzzle-chat").html()

describe 'login', ->
  @timeout 10000
  it 'only sends email hash', ->
    await login 'testy', 'Teresa Tybalt', 'fake@artifici.al', ''
    await waitForSubscriptions()
    chai.assert.isUndefined Meteor.users.findOne('testy').gravatar
    chai.assert.equal Meteor.users.findOne('testy').gravatar_md5, 'a24f643d34150c3b4053989db38251c9'

  afterEach ->
    logout()
