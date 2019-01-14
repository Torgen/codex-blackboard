# Description:
#   Utility commands for Codexbot
#
# Commands:
#   hubot bot: The answer to <puzzle> is <answer>
#   hubot bot: Call in <answer> [for <puzzle>]
#   hubot bot: Delete the answer to <puzzle>
#   hubot bot: <puzzle> is a new puzzle in round <round>
#   hubot bot: Delete puzzle <puzzle>
#   hubot bot: <round> is a new round in group <group>
#   hubot bot: Delete round <name>
#   hubot bot: New quip: <quip>
#   hubot bot: stuck [on <puzzle>] [because <reason>]
#   hubot bot: unstuck [on <puzzle>]
#   hubot bot: announce <message>

# BEWARE: regular expressions can't start with whitespace in coffeescript
# (https://github.com/jashkenas/coffeescript/issues/3756)
# We need to use a backslash escape as a workaround.

import {rejoin, strip, thingRE, objectFromRoom } from '../imports/botutil.coffee'

share.hubot.codex = (robot) ->

## ANSWERS

# setAnswer
  robot.commands.push 'bot the answer to <puzzle> is <answer> - Updates codex blackboard'
  robot.respond (rejoin /The answer to /,thingRE,/\ is /,thingRE,/$/i), (msg) ->
    name = strip msg.match[1]
    answer = strip msg.match[2]
    who = msg.envelope.user.id
    target = Meteor.callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not target
      target = Meteor.callAs "getByName", who,
        name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return msg.finish()
    res = Meteor.callAs "setAnswer", who,
      type: target.type
      target: target.object._id
      answer: answer
    unless res
      msg.reply useful: true, msg.random ["I knew that!","Not news to me.","Already known.", "It is known.", "So say we all."]
      return
    solution_banter = [
      "Huzzah!"
      "Yay!"
      "Pterrific!"
      "I'm codexstactic!"
      "Who'd have thought?"
      "#{answer}?  Really?  Whoa."
      "Rock on!"
      "#{target.object.name} bites the dust!"
      "#{target.object.name}, meet #{answer}.  We rock!"
    ]
    msg.reply useful: true, msg.random solution_banter
    msg.finish()

  # newCallIn
  robot.commands.push 'bot call in <answer> [for <puzzle>] - Updates codex blackboard'
  robot.respond (rejoin /Call\s*in((?: (?:backsolved?|provided))*)( answer)? /,thingRE,'(?:',/\ for (?:(puzzle|round|round group) )?/,thingRE,')?',/$/i), (msg) ->
    backsolve = /backsolve/.test(msg.match[1])
    provided = /provided/.test(msg.match[1])
    answer = strip msg.match[3]
    type = if msg.match[4]? then msg.match[4].replace(/\s+/g,'')+'s'
    name = if msg.match[5]? then strip msg.match[5]
    who = msg.envelope.user.id
    if name?
      target = Meteor.callAs "getByName", who,
        name: name
        optional_type: type ? "puzzles"
      if not target and not type?
        target = Meteor.callAs "getByName", who, name: name
      if not target
        msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    Meteor.callAs "newCallIn", who,
      type: target.type
      target: target.object._id
      answer: answer
      backsolve: backsolve
      provided: provided
      # I don't mind a little redundancy, but if it bothers you uncomment this:
      #suppressRoom: msg.envelope.room
    msg.reply useful: true, "Okay, \"#{answer}\" for #{target.object.name} added to call-in list!"
    msg.finish()

# deleteAnswer
  robot.commands.push 'bot delete the answer to <puzzle> - Updates codex blackboard'
  robot.respond (rejoin /Delete( the)? answer (to|for)( puzzle)? /,thingRE,/$/i), (msg) ->
    name = strip msg.match[4]
    who = msg.envelope.user.id
    target = Meteor.callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not target
      target = Meteor.callAs "getByName", who, name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    Meteor.callAs "deleteAnswer", who,
      type: target.type
      target: target.object._id
    msg.reply useful: true, "Okay, I deleted the answer to \"#{target.object.name}\"."
    msg.finish()

## PUZZLES

# newPuzzle
  robot.commands.push 'bot <puzzle> is a new [meta]puzzle in <round/meta> - Updates codex blackboard'
  robot.respond (rejoin thingRE,/\ is a new (meta|puzzle|metapuzzle) in(?: (round|meta))? /,thingRE,/$/i), (msg) ->
    pname = strip msg.match[1]
    ptype = msg.match[2]
    rname = strip msg.match[4]
    tname = undefined
    round = undefined
    who = msg.envelope.user.id
    if rname is 'this' and not msg.match[3]
      round = objectFromRoom msg
      return unless round?
    else
      if msg.match[3] is 'round'
        tname = 'rounds'
      else if msg.match[3] is 'meta'
        tname = 'puzzles'
      round = Meteor.callAs "getByName", who,
        name: rname
        optional_type: tname
      if not round
        descriptor =
          if tname
            "a #{share.model.pretty_collection tname}"
          else
            'anything'
        msg.reply useful: true, "I can't find #{descriptor} called \"#{rname}\"."
        return
    extra =
      name: pname
      who: who
    if round.type is 'rounds'
      extra.round = round.object._id
    else if round.type is 'puzzles'
      metaround = Meteor.callAs 'getRoundForPuzzle', who, round.object._id
      extra.round = metaround._id
      extra.feedsInto = [round.object._id]
    else
      msg.reply useful:true, "A new puzzle can't be created in \"#{rname}\" because it's a #{share.model.pretty_collection round.type}."
      msg.finish()
      return
    if ptype isnt 'puzzle'
      extra.puzzles = []
    puzzle = Meteor.callAs "newPuzzle", who, extra
    puzz_url = Meteor._relativeToSiteRootUrl "/puzzles/#{puzzle._id}"
    parent_url = Meteor._relativeToSiteRootUrl "/#{round.type}/#{round.object._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I added <a class='puzzles-link' href='#{UI._escape puzz_url}'>#{UI._escape puzzle.name}</a> to <a class='#{round.type}-link' href='#{UI._escape parent_url}'>#{UI._escape round.object.name}</a>."
    msg.finish()

# deletePuzzle
  robot.commands.push 'bot delete puzzle <puzzle> - Updates codex blackboard'
  robot.respond (rejoin /Delete puzzle /,thingRE,/$/i), (msg) ->
    name = strip msg.match[1]
    who = msg.envelope.user.id
    puzzle = Meteor.callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not puzzle
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    res = Meteor.callAs "deletePuzzle", who, puzzle.object._id
    if res
      msg.reply useful: true, "Okay, I deleted \"#{puzzle.object.name}\"."
    else
      msg.reply useful: true, "Something went wrong."
    msg.finish()

## ROUNDS

# newRound
  robot.commands.push 'bot <round> is a new round - Updates codex blackboard'
  robot.respond (rejoin thingRE,/\ is a new round$/i), (msg) ->
    rname = strip msg.match[1]
    who = msg.envelope.user.id
    round = Meteor.callAs "newRound", who, name: rname
    round_url = Meteor._relativeToSiteRootUrl "/rounds/#{round._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I created round <a class='rounds-link' href='#{UI._escape round_url}'>#{UI._escape rname}</a>."
    msg.finish()

# deleteRound
  robot.commands.push 'bot delete round <round> - Updates codex blackboard'
  robot.respond (rejoin /Delete round /,thingRE,/$/i), (msg) ->
    rname = strip msg.match[1]
    who = msg.envelope.user.id
    round = Meteor.callAs "getByName", who,
      name: rname
      optional_type: "rounds"
    unless round
      msg.reply useful: true, "I can't find a round called \"#{rname}\"."
      return
    res = Meteor.callAs "deleteRound", who, round.object._id
    unless res
      msg.reply useful: true, "Couldn't delete round. (Are there still puzzles in it?)"
      return
    msg.reply useful: true, "Okay, I deleted round \"#{round.object.name}\"."
    msg.finish()

# Quips
  robot.commands.push 'bot new quip <quip> - Updates codex quips list'
  robot.respond (rejoin /new quip:? /,thingRE,/$/i), (msg) ->
    text = strip msg.match[1]
    who = msg.envelope.user.id
    quip = Meteor.callAs "newQuip", who, text
    msg.reply "Okay, added quip.  I'm naming this one \"#{quip.name}\"."
    msg.finish()

# Tags
  robot.commands.push 'bot set <tag> [of <puzzle|round>] to <value> - Adds additional information to blackboard'
  robot.respond (rejoin /set (?:the )?/,thingRE,'(',/\ (?:of|for) (?:(puzzle|round) )?/,thingRE,')? to ',thingRE,/$/i), (msg) ->
    tag_name = strip msg.match[1]
    tag_value = strip msg.match[5]
    who = msg.envelope.user.id
    if msg.match[2]?
      type = if msg.match[3]? then msg.match[3].replace(/\s+/g,'')+'s'
      target = Meteor.callAs 'getByName', who,
        name: strip msg.match[4]
        optional_type: type
      if not target?
        msg.reply useful: true, "I can't find a puzzle called \"#{strip msg.match[4]}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    Meteor.callAs 'setTag', who,
      type: target.type
      object: target.object._id
      name: tag_name
      value: tag_value
    msg.reply useful: true, "The #{tag_name} for #{target.object.name} is now \"#{tag_value}\"."
    msg.finish()

# Stuck
  robot.commands.push 'bot stuck[ on <puzzle>][ because <reason>] - summons help and marks puzzle as stuck on the blackboard'
  robot.respond (rejoin 'stuck(?: on ',thingRE,')?(?: because ',thingRE,')?',/$/i), (msg) ->
    who = msg.envelope.user.id
    if msg.match[1]?
      target = Meteor.callAs 'getByName', who,
        name: msg.match[1]
        optional_type: 'puzzles'
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    unless target.type is 'puzzles'
      msg.reply useful: true, 'Only puzzles can be stuck'
      return msg.finish()
    result = Meteor.callAs 'summon', who,
      object: target.object._id
      how: msg.match[2]
    if result?
      msg.reply useful: true, result
      return msg.finish()
    if msg.envelope.room isnt "general/0" and \
       msg.envelope.room isnt "puzzles/#{target.object._id}"
      msg.reply useful: true, "Help is on the way."
    msg.finish()

  robot.commands.push 'but unstuck[ on <puzzle>] - marks puzzle no longer stuck on the blackboard'
  robot.respond (rejoin 'unstuck(?: on ',thingRE,')?',/$/i), (msg) ->
    who = msg.envelope.user.id
    if msg.match[1]?
      target = Meteor.callAs 'getByName', who,
        name: msg.match[1]
        optional_type: 'puzzles'
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    unless target.type is 'puzzles'
      msg.reply useful: true, 'Only puzzles can be stuck'
      return msg.finish()
    result = Meteor.callAs 'unsummon', who,
      object: target.object._id
    if result?
      msg.reply useful: true, result
      return msg.finish()
    if msg.envelope.room isnt "general/0" and \
       msg.envelope.room isnt "puzzles/#{target.object._id}"
      msg.reply useful: true, "Call for help cancelled"
    msg.finish()

  robot.commands.push 'bot announce <message>'
  robot.respond /announce (.*)$/i, (msg) ->
    Meteor.callAs 'newMessage', msg.envelope.user.id,
      oplog: true
      body: "Announcement: #{msg.match[1]}"
      stream: 'announcements'
    msg.finish()

  wordOrQuote = /([^\"\'\s]+|\"[^\"]+\"|\'[^\']+\')/

  robot.commands.push 'bot poll "Your question" "option 1" "option 2"...'
  robot.respond (rejoin 'poll ', wordOrQuote, '((?: ', wordOrQuote, ')+)', /$/i), (msg) ->
    optsRe = new RegExp rejoin(' ', wordOrQuote), 'g'
    opts = while m = optsRe.exec msg.match[2]
      strip m[1]
    Meteor.callAs 'newPoll', msg.envelope.user.id, msg.envelope.room, strip(msg.match[1]), opts

