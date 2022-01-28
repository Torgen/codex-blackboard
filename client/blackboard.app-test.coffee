'use strict'

import { FlowRouter } from 'meteor/ostrio:flow-router-extra'
import {waitForMethods, waitForSubscriptions, promiseCall, promiseCallOn, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'
import { reactiveLocalStorage } from './imports/storage.coffee'

fill_alertify = (text) ->
  $('#alertify-text').val(text)
  $('#alertify-ok').click()

describe 'blackboard', ->
  @timeout 20000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  it 'sorts rounds in requested order', ->
    FlowRouter.go 'Blackboard'
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
    FlowRouter.go 'Blackboard'
    await waitForSubscriptions()
    isss = share.model.Puzzles.findOne name: 'Interstellar Spaceship'
    chai.assert.isOk isss
    $("#m#{isss._id} tr.meta .puzzles-link").trigger $.Event 'click', {button: 0}
    await afterFlushPromise()
    chai.assert.equal Session.get('currentPage'), 'puzzle'
    chai.assert.equal Session.get('type'), 'puzzles'
    chai.assert.equal Session.get('id'), isss._id

  it 'hides solved', ->
    FlowRouter.go 'Blackboard'
    await waitForSubscriptions()

    joy = share.model.Puzzles.findOne name: 'Joy'
    chai.assert.isOk joy
    $joy = $("#m#{joy._id}")
    warm = share.model.Puzzles.findOne name: 'Warm And Fuzzy'
    chai.assert.isOk warm
    chai.assert.isOk $joy.find("tr[data-puzzle-id=\"#{warm._id}\"]")[0]
    chai.assert.isNotOk $joy.find('.metafooter')[0]

    await promiseCall 'setAnswer',
      target: warm._id
      answer: 'fleece'
    await afterFlushPromise()
    chai.assert.isOk $joy.find("tr[data-puzzle-id=\"#{warm._id}\"]")[0]
    chai.assert.isNotOk $joy.find('.metafooter')[0]

    reactiveLocalStorage.setItem 'hideSolved', 'true'
    await afterFlushPromise()
    chai.assert.isNotOk $joy.find("tr[data-puzzle-id=\"#{warm._id}\"]")[0]
    chai.assert.isOk $joy.find('.metafooter')[0]
    chai.assert.equal $joy.find('.metafooter .num-hidden').text(), '(1 puzzle hidden)'

    await promiseCall 'deleteAnswer', target: warm._id
    await afterFlushPromise()

    chai.assert.isOk $joy.find("tr[data-puzzle-id=\"#{warm._id}\"]")[0]
    chai.assert.isNotOk $joy.find('.metafooter')[0]

    reactiveLocalStorage.setItem 'hideSolved', 'false'

  describe 'presence filter', ->
    other_conn = null
    puzz1 = null
    puzz2 = null
    before ->
      puzz1 = share.model.Puzzles.findOne name: 'A Learning Path'
      puzz2 = share.model.Puzzles.findOne name: 'Unfortunate AI'
      other_conn = DDP.connect Meteor.absoluteUrl()
      await promiseCallOn other_conn, 'login',
        nickname: 'incognito'
        real_name: 'Mister Snrub'
        password: 'failphrase'
      p1 = new Promise (resolve) ->
        other_conn.subscribe 'register-presence', "puzzles/#{puzz1._id}", 'chat', onReady: resolve
      p2 = new Promise (resolve) ->
        other_conn.subscribe 'register-presence', "puzzles/#{puzz2._id}", 'jitsi', onReady: resolve
      await Promise.all [p1,p2]
      FlowRouter.go 'Blackboard'
      await waitForSubscriptions()
      await afterFlushPromise()
      $('.bb-show-filter-by-user').click()

    afterEach ->
      $('.bb-clear-filter-by-user').click()
      $('.puzzle-working .button-group.open .bb-show-filter-by-user').click()
      await afterFlushPromise()

    checkPage = ->
      chai.assert.isOk $('#searchResults')[0]
      $puzz1 = $("[data-puzzle-id=\"#{puzz1._id}\"]")
      chai.assert.equal $puzz1.length, 1
      chai.assert.equal $puzz1.find('.nick.background[data-nick="incognito"]').length, 1
      $puzz2 = $("[data-puzzle-id=\"#{puzz2._id}\"]")
      chai.assert.equal $puzz2.length, 1
      chai.assert.equal $puzz2.find('.nick[data-nick="incognito"]:not(.background)').length, 1
      chai.assert.isNotOk $("[data-puzzle-id=\"#{share.model.Puzzles.findOne name: 'AKA'}\"]")[0]

    it 'supports typeahead', ->
      $('.bb-filter-by-user').val('cogn').trigger('keyup')
      $('li[data-value="incognito"] a').click()
      await afterFlushPromise()
      checkPage()

    it 'searches by nickname substring', ->
      $('.bb-filter-by-user').val('cogn').trigger(new $.Event 'keyup', keyCode: 13)
      await afterFlushPromise()
      checkPage()

    it 'searches by name substring', ->
      $('.bb-filter-by-user').val('nru').trigger(new $.Event 'keyup', keyCode: 13)
      await afterFlushPromise()
      checkPage()

    after ->
      other_conn.disconnect()

  describe 'in edit mode', ->

    it 'allows reordering puzzles', ->
      FlowRouter.go 'Edit'
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
      FlowRouter.go 'Edit'
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
      FlowRouter.go 'Edit'
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
      FlowRouter.go 'Edit'
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
      FlowRouter.go 'Edit'
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
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"]").first().click()
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] input").first().val('yuno pay interest?').trigger new $.Event('keydown', which: 27)
      await waitForMethods()
      # no edit on escape
      edit = bank()
      chai.assert.include edit.tags.meme,
        name: 'Meme'
        value: 'yuno accept deposits?'
        touched_by: 'testy'
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"]").first().click()
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] input").first().val('yuno pay interest?').trigger new $.Event('keyup', which: 13)
      await waitForMethods()
      # Edit on enter
      edit = bank()
      chai.assert.include edit.tags.meme,
        name: 'Meme'
        value: 'yuno pay interest?'
        touched_by: 'testy'
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"]").first().click()
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] input").first().val('').trigger new $.Event('keyup', which: 13)
      await waitForMethods()
      # empty cancels
      edit = bank()
      chai.assert.include edit.tags.meme,
        name: 'Meme'
        value: 'yuno pay interest?'
        touched_by: 'testy'
      await afterFlushPromise()
      $("[data-bbedit=\"tags/#{initial._id}/meme/value\"] .bb-delete-icon").first().click()
      await afterFlushPromise()
      $("#confirmModal .bb-confirm-ok").click()
      await waitForMethods()
      deleted = bank()
      chai.assert.notOk deleted.tags.meme

  it 'makes a puzzle a favorite', ->
    FlowRouter.go 'Blackboard'
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
