'use strict'

import {waitForMethods, waitForSubscriptions, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

fill_alertify = (text) ->
  $('#alertify-text').val(text)
  $('#alertify-ok').click()

describe 'blackboard', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
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

  it 'navigates to puzzle on click', ->
    share.Router.BlackboardPage()
    await waitForSubscriptions()
    isss = share.model.Puzzles.findOne name: 'Interstellar Spaceship'
    chai.assert.isOk isss
    $("#m#{isss._id} tr.meta .puzzles-link").trigger $.Event 'click', {button: 0}
    await afterFlushPromise()
    chai.assert.equal Session.get('currentPage'), 'puzzle'
    chai.assert.equal Session.get('type'), 'puzzles'
    chai.assert.equal Session.get('id'), isss._id

  describe 'in edit mode', ->

    it 'allows reordering puzzles', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      wall_street = share.model.Puzzles.findOne name: 'Wall Street'
      maths = share.model.Puzzles.findOne name: 'Advanced Maths'
      cheaters = share.model.Puzzles.findOne name: 'Cheaters Never Prosper'
      mathsJQ = $ "#m#{wall_street._id} tr[data-puzzle-id=\"#{maths._id}\"]"
      cheatersJQ = $ "#m#{wall_street._id} tr[data-puzzle-id=\"#{cheaters._id}\"]"
      chai.assert.isBelow mathsJQ.offset().top, cheatersJQ.offset().top, 'before reorder'
      mathsJQ.find('button.bb-move-down').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isAbove mathsJQ.offset().top, cheatersJQ.offset().top, 'after down'
      mathsJQ.find('button.bb-move-up').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isBelow mathsJQ.offset().top, cheatersJQ.offset().top, 'after up'

    it 'allows reordering metas', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      sadness = share.model.Puzzles.findOne name: 'Sadness'
      fear = share.model.Puzzles.findOne name: 'Fear'

      sadnessJQ = $ "#m#{sadness._id} tr.meta"
      fearJQ = $ "#m#{fear._id} tr.meta"
      chai.assert.isBelow sadnessJQ.offset().top, fearJQ.offset().top, 'before reorder'
      sadnessJQ.find('button.bb-move-down').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isAbove sadnessJQ.offset().top, fearJQ.offset().top, 'after down'
      sadnessJQ.find('button.bb-move-up').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isBelow sadnessJQ.offset().top, fearJQ.offset().top, 'after up'
      $('button[data-sortreverse="true"]').click()
      await afterFlushPromise()
      chai.assert.isAbove sadnessJQ.offset().top, fearJQ.offset().top, 'after reverse'
      sadnessJQ.find('button.bb-move-up').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isBelow sadnessJQ.offset().top, fearJQ.offset().top, 'after up reversed'
      sadnessJQ.find('button.bb-move-down').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isAbove sadnessJQ.offset().top, fearJQ.offset().top, 'after down reversed'
      $('button[data-sortreverse="false"]').click()
      await afterFlushPromise()

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
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isAbove cluelessJQ.offset().top, akaJQ.offset().top, 'after alpha'
      disgustJQ.find('button[data-sort-order=""]').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.isBelow cluelessJQ.offset().top, akaJQ.offset().top, 'after manual'

    it 'allows creating puzzles with buttons', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      $('button.bb-add-round').click()
      fill_alertify 'Created Round'
      await waitForMethods()
      await afterFlushPromise()
      round = share.model.Rounds.findOne name: 'Created Round'
      chai.assert.isOk round, 'round'
      $("#round#{round._id} button.bb-add-meta").click()
      fill_alertify 'Created Meta'
      await waitForMethods()
      await afterFlushPromise()
      meta = share.model.Puzzles.findOne name: 'Created Meta'
      chai.assert.isOk meta, 'meta'
      chai.assert.isArray meta.puzzles
      $("#m#{meta._id} .bb-meta-buttons .bb-add-puzzle").click()
      fill_alertify 'Directly Created'
      await waitForMethods()
      await afterFlushPromise()
      direct = share.model.Puzzles.findOne name: 'Directly Created'
      chai.assert.isOk direct, 'direct'
      chai.assert.include direct.feedsInto, meta._id
      $("#round#{round._id} .bb-add-puzzle").click()
      fill_alertify 'Indirectly Created'
      await waitForMethods()
      await afterFlushPromise()
      indirect = share.model.Puzzles.findOne name: 'Indirectly Created'
      chai.assert.isOk indirect, 'indirect'
      chai.assert.notInclude indirect.feedsInto, meta._id
      $("#unassigned#{round._id} [data-bbedit=\"feedsInto/#{indirect._id}\"]").click()
      await afterFlushPromise()
      $("#unassigned#{round._id} [data-bbedit=\"feedsInto/#{indirect._id}\"] [data-puzzle-id=\"#{meta._id}\"]").click()
      await waitForMethods()
      await afterFlushPromise()
      indirect = share.model.Puzzles.findOne name: 'Indirectly Created'
      chai.assert.include indirect.feedsInto, meta._id

    it 'adds and deletes tags', ->
      share.Router.EditPage()
      await waitForSubscriptions()
      await afterFlushPromise()
      bank = -> share.model.Puzzles.findOne name: 'Letter Bank'
      initial = bank()
      chai.assert.notOk initial.tags.meme
      $("[data-puzzle-id=\"#{initial._id}\"] .bb-add-tag").first().click()
      fill_alertify 'Meme'
      creation = bank()
      await waitForMethods()
      chai.assert.include creation.tags.meme,
        name: 'Meme'
        value: ''
        touched_by: 'testy'
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"]").first().click()
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] input").first().val('yuno accept deposits?').focusout()
      await waitForMethods()
      edit = bank()
      chai.assert.include edit.tags.meme,
        name: 'Meme'
        value: 'yuno accept deposits?'
        touched_by: 'testy'
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] .bb-delete-icon").first().click()
      await afterFlushPromise()
      $("#confirmModal .bb-confirm-ok").click()
      await waitForMethods()
      deleted = bank()
      chai.assert.notOk deleted.tags.meme

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
