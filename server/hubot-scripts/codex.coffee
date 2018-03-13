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

share.hubot.codex = (robot) ->

## ANSWERS

# setAnswer
  robot.commands.push 'bot the answer to <puzzle> is <answer> - Updates codex blackboard'
  robot.respond (share.botutil.share.botutil.rejoin /The answer to /,share.botutil.thingRE,/\ is /,share.botutil.thingRE,/$/i), (msg) ->
    name = share.botutil.strip msg.match[1]
    answer = share.botutil.strip msg.match[2]
    who = msg.envelope.user.id
    target = Meteor.call "getByName",
      name: name
      optional_type: "puzzles"
    if not target
      target = Meteor.call "getByName",
        name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return msg.finish()
    res = Meteor.call "setAnswer",
      type: target.type
      target: target.object._id
      answer: answer
      who: who
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
  robot.respond (share.botutil.rejoin /Call\s*in((?: (?:backsolved?|provided))*)( answer)? /,share.botutil.thingRE,'(?:',/\ for (?:(puzzle|round|round group) )?/,share.botutil.thingRE,')?',/$/i), (msg) ->
    backsolve = /backsolve/.test(msg.match[1])
    provided = /provided/.test(msg.match[1])
    answer = share.botutil.strip msg.match[3]
    type = if msg.match[4]? then msg.match[4].replace(/\s+/g,'')+'s'
    name = if msg.match[5]? then share.botutil.strip msg.match[5]
    who = msg.envelope.user.id
    if name?
      target = Meteor.call "getByName",
        name: name
        optional_type: type ? "puzzles"
      if not target and not type?
        target = Meteor.call "getByName",
          name: name
      if not target
        msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
        return msg.finish()
    else
      target = share.botutil.objectFromRoom msg
      return unless target?
    Meteor.call "newCallIn",
      type: target.type
      target: target.object._id
      answer: answer
      who: who
      backsolve: backsolve
      provided: provided
      # I don't mind a little redundancy, but if it bothers you uncomment this:
      #suppressRoom: msg.envelope.room
    msg.reply useful: true, "Okay, \"#{answer}\" for #{target.object.name} added to call-in list!"
    msg.finish()

# deleteAnswer
  robot.commands.push 'bot delete the answer to <puzzle> - Updates codex blackboard'
  robot.respond (share.botutil.rejoin /Delete( the)? answer (to|for)( puzzle)? /,share.botutil.thingRE,/$/i), (msg) ->
    name = share.botutil.strip msg.match[4]
    who = msg.envelope.user.id
    target = Meteor.call "getByName",
      name: name
      optional_type: "puzzles"
    if not target
      target = Meteor.call "getByName",
        name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    Meteor.call "deleteAnswer",
      type: target.type
      target: target.object._id
      who: who
    msg.reply useful: true, "Okay, I deleted the answer to \"#{target.object.name}\"."
    msg.finish()

## PUZZLES

# newPuzzle
  robot.commands.push 'bot <puzzle> is a new puzzle in round <round> - Updates codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE,/\ is a new puzzle in( round)? /,share.botutil.thingRE,/$/i), (msg) ->
    pname = share.botutil.strip msg.match[1]
    rname = share.botutil.strip msg.match[3]
    who = msg.envelope.user.id
    round = Meteor.call "getByName",
      name: rname
      optional_type: "rounds"
    if not round
      msg.reply useful: true, "I can't find a round called \"#{rname}\"."
      return
    puzzle = Meteor.call "newPuzzle",
      name: pname
      who: who
      round: round.object._id
    puzz_url = Meteor._relativeToSiteRootUrl "/puzzles/#{puzzle._id}"
    round_url = Meteor._relativeToSiteRootUrl "/rounds/#{round.object._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I added <a class='puzzles-link' href='#{UI._escape puzz_url}'>#{UI._escape puzzle.name}</a> to <a class='rounds-link' href='#{UI._escape round_url}'>#{UI._escape round.object.name}</a>."
    msg.finish()

# TODO(torgen): A version of above that takes a meta instead of a round.
# The new puzzle will be in the same round as the meta, and will feed into
# it instead of the round's default meta (if any).

# deletePuzzle
  robot.commands.push 'bot delete puzzle <puzzle> - Updates codex blackboard'
  robot.respond (share.botutil.rejoin /Delete puzzle /,share.botutil.thingRE,/$/i), (msg) ->
    name = share.botutil.strip msg.match[1]
    who = msg.envelope.user.id
    puzzle = Meteor.call "getByName",
      name: name
      optional_type: "puzzles"
    if not puzzle
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    res = Meteor.call "deletePuzzle",
      id: puzzle.object._id
      who: who
    if res
      msg.reply useful: true, "Okay, I deleted \"#{puzzle.object.name}\"."
    else
      msg.reply useful: true, "Something went wrong."
    msg.finish()

## ROUNDS

# newRound
  robot.commands.push 'bot <round> is a new round - Updates codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE,/\ is a new round$/i), (msg) ->
    rname = share.botutil.strip msg.match[1]
    round = Meteor.call "newRound",
      name: rname
      who: "codexbot"
    round_url = Meteor._relativeToSiteRootUrl "/rounds/#{round._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I created round <a class='rounds-link' href='#{UI._escape round_url}'>#{UI._escape rname}</a>."
    msg.finish()

# deleteRound
  robot.commands.push 'bot delete round <round> - Updates codex blackboard'
  robot.respond (share.botutil.rejoin /Delete round /,share.botutil.thingRE,/$/i), (msg) ->
    rname = share.botutil.strip msg.match[1]
    who = msg.envelope.user.id
    round = Meteor.call "getByName",
      name: rname
      optional_type: "rounds"
    unless round
      msg.reply useful: true, "I can't find a round called \"#{rname}\"."
      return
    res = Meteor.call "deleteRound",
      id: round.object._id
      who: who
    unless res
      msg.reply useful: true, "Couldn't delete round. (Are there still puzzles in it?)"
      return
    msg.reply useful: true, "Okay, I deleted round \"#{round.object.name}\"."
    msg.finish()

# Quips
  robot.commands.push 'bot new quip <quip> - Updates codex quips list'
  robot.respond (share.botutil.rejoin /new quip:? /,share.botutil.thingRE,/$/i), (msg) ->
    text = share.botutil.strip msg.match[1]
    who = msg.envelope.user.id
    quip = Meteor.call "newQuip",
      text: text
      who: who
    msg.reply "Okay, added quip.  I'm naming this one \"#{quip.name}\"."
    msg.finish()

# Tags
  robot.commands.push 'bot set <tag> [of <puzzle|round>] to <value> - Adds additional information to blackboard'
  robot.respond (share.botutil.rejoin /set (?:the )?/,share.botutil.thingRE,'(',/\ (?:of|for) (?:(puzzle|round) )?/,share.botutil.thingRE,')? to ',share.botutil.thingRE,/$/i), (msg) ->
    tag_name = share.botutil.strip msg.match[1]
    tag_value = share.botutil.strip msg.match[5]
    who = msg.envelope.user.id
    if msg.match[2]?
      type = if msg.match[3]? then msg.match[3].replace(/\s+/g,'')+'s'
      target = Meteor.call 'getByName',
        name: share.botutil.strip msg.match[4]
        optional_type: type
      if not target?
        msg.reply useful: true, "I can't find a puzzle called \"#{share.botutil.strip msg.match[4]}\"."
        return msg.finish()
    else
      target = share.botutil.objectFromRoom msg
      return unless target?
    Meteor.call 'setTag',
      type: target.type
      object: target.object._id
      name: tag_name
      value: tag_value
      who: who
    msg.reply useful: true, "The #{tag_name} for #{target.object.name} is now \"#{tag_value}\"."
    msg.finish()

# Stuck
  robot.commands.push 'bot stuck[ on <puzzle>][ because <reason>] - summons help and marks puzzle as stuck on the blackboard'
  robot.respond (share.botutil.rejoin 'stuck(?: on ',share.botutil.thingRE,')?(?: because ',share.botutil.thingRE,')?',/$/i), (msg) ->
    if msg.match[1]?
      target = Meteor.call 'getByName',
        name: msg.match[1]
        type: 'puzzles'
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = share.botutil.objectFromRoom msg
      return unless target?
      if target.type isnt 'puzzles'
        msg.reply useful: true, "You need to tell me which puzzle is stuck."
        return msg.finish()
    result = Meteor.call 'summon',
      object: target.object._id
      value: msg.match[2]
      who: msg.envelope.user.id
    if result?
      msg.reply useful: true, result
      return msg.finish()
    if msg.envelope.room isnt "general/0" and \
       msg.envelope.room isnt "puzzles/#{target.object._id}"
      msg.reply useful: true, "Help is on the way."
    msg.finish()

  robot.commands.push 'but unstuck[ on <puzzle>] - marks puzzle no longer stuck on the blackboard'
  robot.respond (share.botutil.rejoin 'unstuck(?: on ',share.botutil.thingRE,')?',/$/i), (msg) ->
    if msg.match[1]?
      target = Meteor.call 'getByName', name: msg.match[1]
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = share.botutil.objectFromRoom msg
      return unless target?
    result = Meteor.call 'unsummon',
      type: target.type
      object: target.object._id
      who: msg.envelope.user.id
    if result?
      msg.reply useful: true, result
      return msg.finish()
    if msg.envelope.room isnt "general/0" and \
       msg.envelope.room isnt "#{target.type}/#{target.object._id}"
      msg.reply useful: true, "Call for help cancelled"
    msg.finish()

  robot.commands.push 'bot announce <message>'
  robot.respond /announce (.*)$/i, (msg) ->
    Meteor.call 'newMessage',
      oplog: true
      nick: msg.envelope.user.id
      body: "Announcement: #{msg.match[1]}"
      stream: 'announcements'
    msg.finish()
