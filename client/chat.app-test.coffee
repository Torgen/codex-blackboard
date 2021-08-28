'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'chat', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', 'failphrase')
  
  after ->
    logout()

  it 'general chat', ->
    share.Router.ChatPage('general', '0')
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isDefined $('a[href^="https://codexian.us"]').html()
    chai.assert.isDefined $('img[src^="https://memegen.link/doge"]').html()
    chai.assert.equal $('.bb-chat-presence-block').length, 0
    $('.bb-show-whos-here').click()
    await afterFlushPromise()
    chai.assert.equal $('.bb-chat-presence-block tr').length, 2
    $('.bb-show-whos-here').click()
    await afterFlushPromise()
    chai.assert.equal $('.bb-chat-presence-block').length, 0

  it 'updates read marker', ->
    id = share.model.Puzzles.findOne(name: 'Temperance')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    top = $('.bb-message-last-read').offset().top
    $('#messageInput').focus()
    await waitForMethods()
    chai.assert.isAbove $('.bb-message-last-read').offset().top, top, 'after'

  it 'scrolls through history', ->
    id = share.model.Puzzles.findOne(name: 'Joy')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    input = $ '#messageInput'
    input.val '/me tests actions'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after first submit'
    input.val 'say another thing'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after second submit'
    await waitForSubscriptions()
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), 'say another thing', 'after first up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after second up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after third up'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '/me tests actions', 'after down with selection at start'
    input[0].setSelectionRange input.val().length, input.val().length
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), 'say another thing', 'after first down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after second down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after third down'

  it 'loads more', ->
    @timeout 30000
    puzz = share.model.Puzzles.findOne name: 'Literary Collection'
    share.Router.ChatPage('puzzles', puzz._id)
    room = "puzzles/#{puzz._id}"
    await waitForSubscriptions()
    await afterFlushPromise()
    for _ in [1..125]
      await promiseCall 'newMessage',
        body: 'spam'
        room_name: room
      await promiseCall 'newMessage',
        body: 'spams chat'
        action: true
        room_name: room
    allMessages = $('#messages > *')
    chai.assert.isAbove allMessages.length, 200
    chai.assert.isBelow allMessages.length, 250
    document.querySelector('.bb-chat-load-more').scrollIntoView()
    $('.bb-chat-load-more').click()
    await waitForSubscriptions()
    allMessages = $('#messages > *')
    chai.assert.isAbove allMessages.length, 250

  it 'deletes message', ->
    puzz = share.model.Puzzles.findOne name: 'Freak Out'
    share.Router.ChatPage('puzzles', puzz._id)
    room = "puzzles/#{puzz._id}"
    await waitForSubscriptions()
    await afterFlushPromise()
    msg = await promiseCall 'newMessage',
        body: 'my social security number is XXX-YY-ZZZZ'
        room_name: room
    await afterFlushPromise()
    $badmsg = $("#messages [data-message-id=\"#{msg._id}\"]")
    chai.assert.isOk $badmsg[0]
    $badmsg.find('.bb-delete-message').click()
    $('#alertify-ok').click()
    await waitForMethods()
    $badmsg = $("#messages [data-message-id=\"#{msg._id}\"]")
    chai.assert.isNotOk $badmsg[0]
    chai.assert.isNotOk share.model.Messages.findOne msg._id

  describe '/join', ->
    it 'joins puzzle', ->
      puzz = share.model.Puzzles.findOne name: 'Painted Potsherds'
      share.Router.ChatPage('general', '0')
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/join painted potsherds'
      input.trigger $.Event('keydown', {which: 13})
      chai.assert.equal input.val(), ''
      chai.assert.equal Session.get('type'), 'puzzles'
      chai.assert.equal Session.get('id'), puzz._id

    it 'joins round', ->
      rnd = share.model.Rounds.findOne name: 'Civilization'
      share.Router.ChatPage('general', '0')
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/join civilization'
      input.trigger $.Event('keydown', {which: 13})
      chai.assert.equal input.val(), ''
      chai.assert.equal Session.get('type'), 'rounds'
      chai.assert.equal Session.get('id'), rnd._id

    it 'joins general', ->
      rnd = share.model.Rounds.findOne name: 'Civilization'
      share.Router.ChatPage('rounds', rnd._id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/join ringhunters'
      input.trigger $.Event('keydown', {which: 13})
      chai.assert.equal input.val(), ''
      chai.assert.equal Session.get('type'), 'general'
      chai.assert.equal Session.get('id'), 0

    it 'joins puzzle', ->
      share.Router.ChatPage('general', '0')
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/join pelvic splanchnic ganglion'
      input.trigger $.Event('keydown', {which: 13})
      chai.assert.equal input.val(), '/join pelvic splanchnic ganglion'
      chai.assert.equal Session.get('type'), 'general'
      chai.assert.equal Session.get('id'), 0
      await afterFlushPromise()
      chai.assert.isTrue input.hasClass 'error'

  describe 'typeahead', ->

    it 'accepts keyboard commands', ->
      id = share.model.Puzzles.findOne(name: 'Disgust')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/m a'
      input.click()
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'initial'
      input.trigger $.Event('keydown', {key: 'Down'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'testy', a.data('value'), 'one down'
      input.trigger $.Event('keydown', {key: 'Up'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'up after down'
      input.trigger $.Event('keydown', {key: 'Up'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'zachary', a.data('value'), 'wraparound up'
      input.trigger $.Event('keydown', {key: 'Down'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'wraparound down'
      input.trigger $.Event('keydown', {key: 'Tab'})
      await afterFlushPromise()
      chai.assert.equal input.val(), '/m kwal '
      chai.assert.equal input[0].selectionStart, 8
      typeahead = $ '#messageInputTypeahead'
      chai.assert.equal 0, typeahead.length

    it 'allows clicks', ->
      id = share.model.Puzzles.findOne(name: 'Space Elevator')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val 'Yo @es hmu'
      input[0].setSelectionRange 4, 4
      input.click()
      await afterFlushPromise()
      $('a[data-value="testy"]').click()
      await afterFlushPromise()
      chai.assert.equal input.val(), 'Yo @testy  hmu'
      chai.assert.equal input[0].selectionStart, 10
      typeahead = $ '#messageInputTypeahead'
      chai.assert.equal 0, typeahead.length

  describe 'submit', ->

    it 'mentions', ->
      id = share.model.Puzzles.findOne(name: 'Showcase')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '@kwal you hear about @Cscott?'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        mention: ['kwal', 'cscott']

    it 'nonexistent mentions', ->
      id = share.model.Puzzles.findOne(name: 'Soooo Cute!')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '@kwal exists but @flibby does not'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepEqual msg.mention, ['kwal']

    it 'action', ->
      id = share.model.Puzzles.findOne(name: 'This SHOULD Be Easy')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/me heard about @Cscott'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        action: true
        mention: ['cscott']
        body: 'heard about @Cscott'

    it 'messages', ->
      id = share.model.Puzzles.findOne(name: 'Charm School')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/msg kwal you hear about @Cscott?'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        to: 'kwal'
      chai.assert.isNotOk msg.mention

    it 'errors on message to nobody', ->
      id = share.model.Puzzles.findOne(name: 'Charm School')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/msg cromslor you hear about @Cscott?'
      input.trigger $.Event 'keydown', which: 13
      chai.assert.equal input.val(), '/msg cromslor you hear about @Cscott?'
      await afterFlushPromise()
      chai.assert.isTrue input.hasClass 'error'

  describe 'polls', ->
    it 'lets you change your vote', ->
      id = share.model.Puzzles.findOne(name: 'Amateur Hour')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      poll = await promiseCall 'newPoll', "puzzles/#{id}", 'Flip a coin', ['heads', 'tails']
      await waitForSubscriptions()  # when the message with the poll renders, the subscription to the poll also happens.
      await afterFlushPromise()
      results = $('#messages td.results .bar')
      chai.assert.equal results.length, 2
      chai.assert.equal results[0].style.width, '0%'
      chai.assert.equal results[1].style.width, '0%'
      await promiseCall 'setField',
        type: 'polls'
        object: poll
        fields:
          votes:
            cscott:
              canon: 'heads'
              timestamp: 1
            kwal:
              canon: 'tails'
              timestamp: 2
            zachary:
              canon: 'heads'
              timestamp: 3
      await afterFlushPromise()
      chai.assert.equal results[0].style.width, '100%'
      chai.assert.equal results[1].style.width, '50%'
      $('button[data-option="tails"').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.equal results[0].style.width, '100%'
      chai.assert.equal results[1].style.width, '100%'
      $('button[data-option="heads"').click()
      await waitForMethods()
      await afterFlushPromise()
      chai.assert.equal results[0].style.width, '100%'
      chai.assert.equal results[1].style.width, '33.3333%'
