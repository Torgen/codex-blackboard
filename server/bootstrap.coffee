'use strict'
model = share.model

# if the database is empty on server start, create some sample data.
# (useful during development; disable this before hunt)
POPULATE_DB_WHEN_RESET = !Meteor.settings.production && !Meteor.isProduction

SAMPLE_DATA = []
# TODO(Torgen): Add sample data with interesting meta structure.
# e.g. emotion or scifi round 2018.
SAMPLE_CHATS = [
  nick: "cscott"
  body: "Have we found the coin yet?  Seriously."
,
  nick: "cscott"
  body: "This is a very very long line which should hopefully wrap and that will show that we're doing all this correctly. Let's keep going here. More and more stuff! Wow."
]
SAMPLE_NICKS = [
  name: "cscott"
  tags: [
    { name: "Real Name", value: "C. Scott" }
    { name: "Gravatar", value: "user@host.org" }
  ]
,
  name: "zachary"
  tags: [
    { name: "Gravatar", value: "z@x.org" }
  ]
,
  name: "kwal"
  tags: [
    { name: "Real Name", value: "Kevin Wallace" }
    { name: "Gravatar", value: "kevin@pentabarf.net" }
  ]
]
SAMPLE_QUIPS = [
  text: "A codex is a book made up of a number of sheets of paper, vellum, papyrus, or similar, with hand-written content"
  who: "kwal"
,
  text: "Hello, this is Codex! We wrote the book on mystery hunts."
  who: "cscott"
]

Meteor.startup ->
  if model.DO_BATCH_PROCESSING and POPULATE_DB_WHEN_RESET and model.Rounds.find().count() is 0
    # Meteor.call is sync on server!
    console.log 'Populating initial puzzle database...'
    console.log '(use production:true in settings.json to disable this)'
    WHO='cscott'
    extend = (a,b) ->
      r = Object.create(null)
      for own key, value of a
        r[key] = value
      for own key, value of b
        r[key] = value
      return r
    for round in SAMPLE_DATA
      console.log ' Round:', round.name
      r = Meteor.call "newRound", extend(round,{who:WHO,puzzles:[]})
      for puzzle in round.puzzles
        console.log '  Puzzle:', puzzle.name
        p = Meteor.call "newPuzzle", extend(puzzle,{who:WHO, round: r._id})
        if puzzle.answer
          Meteor.call "setAnswer", {target:p._id, answer:puzzle.answer, who:WHO}
        for chat in (puzzle.chats or [])
          chat.room_name = "puzzles/" + p._id
          Meteor.call "newMessage", chat
    # add some general chats
    for chat in SAMPLE_CHATS
      chat.room_name = "general/0"
      Meteor.call "newMessage", chat
    # add some user ids
    for nick in SAMPLE_NICKS
      Meteor.call "newNick", nick
    # add some quips
    for quip in SAMPLE_QUIPS
      Meteor.call "newQuip", quip
    console.log 'Done populating initial database.'
