'use strict'
model = share.model # import
settings = share.settings # import

capType = (type) ->
  if type is 'puzzles'
    'Puzzle'
  else if type is 'rounds'
    'Round'

Template.puzzle.helpers
  tag: (name) -> (model.getTag this, name) or ''
  data: ->
    r = {}
    r.type = Session.get('type')
    if r.type is 'puzzles'
      puzzle = r.puzzle = model.Puzzles.findOne Session.get("id")
      round = r.round = model.Rounds.findOne puzzles: puzzle?._id
      r.puzzle_num = 1 + (round?.puzzles or []).indexOf(puzzle?._id)
    else
      puzzle = r.puzzle = round = r.round = model.Rounds.findOne Session.get("id")
      r.puzzles = ((model.Puzzles.findOne(p) or {_id:p}) \
        for p in (round?.puzzles or []))
    group = r.group = model.RoundGroups.findOne rounds: round?._id
    r.round_num = 1 + group?.round_start + \
                  (group?.rounds or []).indexOf(round?._id)
    r.stuck = model.isStuck puzzle
    r.capType = capType r.type
    return r

Template.puzzle.onCreated ->
  $('html').addClass('fullHeight')
  share.chat.startupChat()
  this.autorun =>
    # set page title
    type = Session.get('type')
    id = Session.get('id')
    name = model.collection(type)?.findOne(id)?.name or id
    $("title").text("#{capType type}: #{name}")
  # presumably we also want to subscribe to the puzzle's chat room
  # and presence information at some point.
  this.autorun =>
    return if settings.BB_SUB_ALL
    id = Session.get('id')
    return unless id
    if Session.equals("type", "puzzles")
      this.subscribe 'puzzle-by-id', id
      this.subscribe 'round-for-puzzle', id
      round = model.Rounds.findOne puzzles: id
    else if Session.equals("type", "rounds")
      this.subscribe 'round-by-id', _id
      this.subscribe 'roundgroup-for-round', round_id
      round = model.Rounds.findOne round_id
      for p in round?.puzzles
        this.subscribe 'puzzle-by-id', p
    return unless round
    this.subscribe 'roundgroup-for-round', round._id

Template.puzzle.onRendered ->
  $('html').addClass('fullHeight')
  share.Splitter.hsize.set()
# XXX we originally did this every time anything in the template was changed:
#  share.Splitter.vsize.set() unless share.Splitter.vsize.manualResized
# with the new `onRendered` callback semantics this isn't possible.  Maybe we
# don't really need it?
Template.puzzle.onDestroyed ->
  $('html').removeClass('fullHeight')
  share.chat.cleanupChat()

Template.puzzle.events
  "mousedown .bb-splitter-handle": (e,t) -> share.Splitter.handleEvent(e,t)

Template.puzzle_summon_modal.helpers
  stuck: -> model.isStuck this

Template.puzzle_summon_modal.events
  "click .bb-summon-btn.stuck": (event, template) ->
    share.ensureNick =>
      share.confirmationDialog
        message: 'Are you sure you want to cancel this request for help?'
        ok_button: "Yes, this #{model.pretty_collection(Session.get 'type')} is no longer stuck"
        no_button: 'Nevermind, this is still STUCK'
        ok: ->
          Meteor.call 'unsummon',
            who: Session.get 'nick'
            type: Session.get 'type'
            object: Session.get 'id'
  "click .bb-summon-btn.unstuck": (event, template) ->
    share.ensureNick =>
      template.$('.stuck-at').val('at start')
      template.$('.stuck-need').val('ideas')
      template.$('.stuck-other').val('')
      template.$('.bb-callin-submit').focus()
      template.$('.modal').modal show: true
  "click .bb-summon-submit, submit form": (event, template) ->
    event.preventDefault() # don't reload page
    at = template.$('.stuck-at').val()
    need = template.$('.stuck-need').val()
    other = template.$('.stuck-other').val()
    how = "Stuck #{at}"
    if need isnt 'other'
        how += ", need #{need}"
    if other isnt ''
        how += ": #{other}"
    Meteor.call 'summon',
      who: Session.get 'nick'
      type: Session.get 'type'
      object: Session.get 'id'
      how: how
    template.$('.modal').modal 'hide'

Template.puzzle_callin_modal.events
  "click .bb-callin-btn": (event, template) ->
    share.ensureNick =>
      template.$('input:text').val('')
      template.$('input:checked').val([])
      template.$('.modal').modal show: true
      template.$('input:text').focus()
  "click .bb-callin-submit, submit form": (event, template) ->
    event.preventDefault() # don't reload page
    answer = template.$('.bb-callin-answer').val()
    return unless answer
    backsolve = ''
    if template.$('input:checked[value="provided"]').val() is 'provided'
      backsolve += "provided "
    if template.$('input:checked[value="backsolve"]').val() is 'backsolve'
      backsolve += "backsolved "
    if backsolve
      backsolve += "answer "
    if /answer|backsolve|provided|for|puzzle|^[\'\"]/i.test(answer)
      answer = '"' + answer.replace(/\"/g,'\\"') + '"'
    Meteor.call "newMessage",
      body: "bot: call in #{backsolve}#{answer.toUpperCase()}"
      nick: Session.get 'nick'
      room_name: "#{Session.get 'type'}/#{Session.get 'id'}"
    template.$('.modal').modal 'hide'
