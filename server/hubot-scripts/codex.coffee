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
'use strict'

import {rejoin, strip, thingRE, objectFromRoom } from '../imports/botutil.coffee'
import { callAs, impersonating } from '../imports/impersonate.coffee'
import { all_settings } from '/lib/imports/settings.coffee'
import canonical from '/lib/imports/canonical.coffee'
import isDuplicateError from '/lib/imports/duplicate.coffee'
import * as callin_types from '/lib/imports/callin_types.coffee'

share.hubot.codex = (robot) ->

## ANSWERS

# setAnswer
  robot.commands.push 'bot the answer to <puzzle> is <answer> - Updates codex blackboard'
  robot.respond (rejoin /The answer to /,thingRE,/\ is /,thingRE,/$/i), (msg) ->
    name = strip msg.match[1]
    answer = strip msg.match[2]
    who = msg.envelope.user.id
    target = callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not target
      target = callAs "getByName", who,
        name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return msg.finish()
    res = callAs "setAnswer", who,
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
  robot.respond (rejoin /Call\s*in((?: (?:backsolved?|provided))*)( answer)? /,thingRE,'(?:',/\ for /,thingRE,')?',/$/i), (msg) ->
    backsolve = /backsolve/.test(msg.match[1])
    provided = /provided/.test(msg.match[1])
    answer = strip msg.match[3]
    name = if msg.match[4]? then strip msg.match[4]
    who = msg.envelope.user.id
    if name?
      target = callAs "getByName", who,
        name: name
        optional_type: type ? "puzzles"
      if not target and not type?
        target = callAs "getByName", who, name: name
      if not target
        msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    callAs "newCallIn", who,
      target_type: target.type
      target: target.object._id
      answer: answer
      backsolve: backsolve
      provided: provided
      # I don't mind a little redundancy, but if it bothers you uncomment this:
      #suppressRoom: msg.envelope.room
    msg.reply useful: true, "Okay, \"#{answer}\" for #{target.object.name} added to call-in list!"
    msg.finish()

  robot.commands.push 'bot request interaction <answer> [for <puzzle>] - Updates codex blackboard'
  robot.commands.push 'bot tell hq <message> [for <puzzle>] - Updates codex blackboard'
  robot.commands.push 'bot expect callback <message> [for <puzzle>] - Updates codex blackboard'
  robot.respond (rejoin /(Request\s+interaction|tell\s+hq|expect\s+callback) /,thingRE,'(?:',/\ for /,thingRE,')?',/$/i), (msg) ->
    callin_type = switch canonical(msg.match[1])
      when 'request_interaction'
        callin_types.INTERACTION_REQUEST
      when 'tell_hq'
        callin_types.MESSAGE_TO_HQ
      when 'expect_callback'
        callin_types.EXPECTED_CALLBACK

    answer = strip msg.match[2]
    name = if msg.match[3]? then strip msg.match[3]
    who = msg.envelope.user.id
    if name?
      target = callAs "getByName", who,
        name: name
        optional_type: type ? "puzzles"
      if not target and not type?
        target = callAs "getByName", who, name: name
      if not target
        msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    callAs "newCallIn", who,
      target_type: target.type
      target: target.object._id
      answer: answer
      callin_type: callin_type
      # I don't mind a little redundancy, but if it bothers you uncomment this:
      #suppressRoom: msg.envelope.room
    msg.reply useful: true, "Okay, #{callin_type} \"#{answer}\" for #{target.object.name} added to call-in list!"
    msg.finish()

# deleteAnswer
  robot.commands.push 'bot delete the answer to <puzzle> - Updates codex blackboard'
  robot.respond (rejoin /Delete( the)? answer (to|for)( puzzle)? /,thingRE,/$/i), (msg) ->
    name = strip msg.match[4]
    who = msg.envelope.user.id
    target = callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not target
      target = callAs "getByName", who, name: name
    if not target
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    callAs "deleteAnswer", who,
      type: target.type
      target: target.object._id
    msg.reply useful: true, "Okay, I deleted the answer to \"#{target.object.name}\"."
    msg.finish()

## PUZZLES

# newPuzzle
  robot.commands.push 'bot <puzzle> is a new [meta]puzzle in <round/meta> [with link <url>]- Updates codex blackboard'
  robot.respond (rejoin thingRE,/\ is a new (meta|puzzle|metapuzzle) in(?: (round|meta))? /,thingRE,'(?:',/ with (?:url|link) /,thingRE,')?',/$/i), (msg) ->
    pname = strip msg.match[1]
    ptype = msg.match[2]
    rname = strip msg.match[4]
    tname = undefined
    round = undefined
    url = strip msg.match[5]
    who = msg.envelope.user.id
    if rname is 'this' and not msg.match[3]
      round = objectFromRoom msg
      return unless round?
    else
      if msg.match[3] is 'round'
        tname = 'rounds'
      else if msg.match[3] is 'meta'
        tname = 'puzzles'
      round = callAs "getByName", who,
        name: rname
        optional_type: tname
      if not round
        descriptor =
          if tname
            "a #{share.model.pretty_collection tname}"
          else
            'anything'
        msg.reply useful: true, "I can't find #{descriptor} called \"#{rname}\"."
        msg.finish()
        return
    extra =
      name: pname
    if url?
      extra.link = url
    if round.type is 'rounds'
      extra.round = round.object._id
    else if round.type is 'puzzles'
      metaround = callAs 'getRoundForPuzzle', who, round.object._id
      extra.round = metaround._id
      extra.feedsInto = [round.object._id]
    else
      msg.reply useful:true, "A new puzzle can't be created in \"#{rname}\" because it's a #{share.model.pretty_collection round.type}."
      msg.finish()
      return
    if ptype isnt 'puzzle'
      extra.puzzles = []
    try
      puzzle = callAs "newPuzzle", who, extra
    catch error
      if isDuplicateError error
        existing = callAs "getByName", who,
          name: pname
          type: 'puzzles'
        puzz_url = Meteor._relativeToSiteRootUrl "/puzzles/#{existing.object._id}"
        msg.reply {useful: true, bodyIsHtml: true}, "There's already <a class='puzzles-link' href='#{UI._escape puzz_url}'>a puzzle named #{UI._escape existing.object.name}</a>."
      else
        console.log error
        msg.reply {useful: true}, "There was an error creating that puzzle."
      msg.finish()
      return
    puzz_url = Meteor._relativeToSiteRootUrl "/puzzles/#{puzzle._id}"
    parent_url = Meteor._relativeToSiteRootUrl "/#{round.type}/#{round.object._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I added <a class='puzzles-link' href='#{UI._escape puzz_url}'>#{UI._escape puzzle.name}</a> to <a class='#{round.type}-link' href='#{UI._escape parent_url}'>#{UI._escape round.object.name}</a>."
    msg.finish()

# deletePuzzle
  robot.commands.push 'bot delete puzzle <puzzle> - Updates codex blackboard'
  robot.respond (rejoin /Delete puzzle /,thingRE,/$/i), (msg) ->
    name = strip msg.match[1]
    who = msg.envelope.user.id
    puzzle = callAs "getByName", who,
      name: name
      optional_type: "puzzles"
    if not puzzle
      msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
      return
    res = callAs "deletePuzzle", who, puzzle.object._id
    if res
      msg.reply useful: true, "Okay, I deleted \"#{puzzle.object.name}\"."
    else
      msg.reply useful: true, "Something went wrong."
    msg.finish()

## ROUNDS

# newRound
  robot.commands.push 'bot <round> is a new round [with link <url>] - Updates codex blackboard'
  robot.respond (rejoin thingRE,/\ is a new round/,'(?:',/ with (?:url|link) /,thingRE,')?',/$/i), (msg) ->
    rname = strip msg.match[1]
    url = strip msg.match[2]
    who = msg.envelope.user.id
    body = name: rname
    if url?
      body.link = url
    try
      round = callAs "newRound", who, body
    catch error
      if isDuplicateError error
        existing = callAs "getByName", who,
          name: rname
          type: 'rounds'
        round_url = Meteor._relativeToSiteRootUrl "/rounds/#{existing.object._id}"
        msg.reply {useful: true, bodyIsHtml: true}, "There's already <a class='round-link' href='#{UI._escape round_url}'>a round named #{UI._escape existing.object.name}</a>."
      else
        console.log error
        msg.reply {useful: true}, "There was an error creating that puzzle."
      msg.finish()
      return
    round_url = Meteor._relativeToSiteRootUrl "/rounds/#{round._id}"
    msg.reply {useful: true, bodyIsHtml: true}, "Okay, I created round <a class='rounds-link' href='#{UI._escape round_url}'>#{UI._escape rname}</a>."
    msg.finish()

# deleteRound
  robot.commands.push 'bot delete round <round> - Updates codex blackboard'
  robot.respond (rejoin /Delete round /,thingRE,/$/i), (msg) ->
    rname = strip msg.match[1]
    who = msg.envelope.user.id
    round = callAs "getByName", who,
      name: rname
      optional_type: "rounds"
    unless round
      msg.reply useful: true, "I can't find a round called \"#{rname}\"."
      return
    res = callAs "deleteRound", who, round.object._id
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
    quip = callAs "newQuip", who, text
    msg.reply "Okay, added quip.  I'm naming this one \"#{quip.name}\"."
    msg.finish()

# Tags
  robot.commands.push 'bot set <tag> [of <puzzle|round>] to <value> - Adds additional information to blackboard'
  robot.respond (rejoin /set (?:the )?/,thingRE,'(',/\ (?:of|for) (?:(puzzle|round) )?/,thingRE,')? to ',thingRE,/$/i), (msg) ->
    tag_name = strip msg.match[1]
    tag_value = strip msg.match[5]
    who = msg.envelope.user.id
    if msg.match[2]?
      descriptor =
        if msg.match[3]?
          "a #{share.model.pretty_collection msg.match[3]}"
        else
          'anything'
      type = if msg.match[3]? then msg.match[3].replace(/\s+/g,'')+'s'
      target = callAs 'getByName', who,
        name: strip msg.match[4]
        optional_type: type
      if not target?
        msg.reply useful: true, "I can't find #{descriptor} called \"#{strip msg.match[4]}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    callAs 'setTag', who,
      type: target.type
      object: target.object._id
      name: tag_name
      value: tag_value
    msg.reply useful: true, "The #{tag_name} for #{target.object.name} is now \"#{tag_value}\"."
    msg.finish()

  robot.commands.push 'bot unset <tag> [of <puzzle|round>] - Removes information from blackboard'
  robot.respond (rejoin /unset (?:the )?/,thingRE,'(',/\ (?:of|for) (?:(puzzle|round) )?/,thingRE,')?',/$/i), (msg) ->
    tag_name = strip msg.match[1]
    who = msg.envelope.user.id
    if msg.match[2]?
      descriptor =
        if msg.match[3]?
          "a #{share.model.pretty_collection msg.match[3]}"
        else
          'anything'
      type = if msg.match[3]? then msg.match[3].replace(/\s+/g,'')+'s'
      target = callAs 'getByName', who,
        name: strip msg.match[4]
        optional_type: type
      if not target?
        msg.reply useful: true, "I can't find #{descriptor} called \"#{strip msg.match[4]}\"."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    res = callAs 'deleteTag', who,
      type: target.type
      object: target.object._id
      name: tag_name
    if res
      msg.reply useful: true, "The #{tag_name} for #{target.object.name} is now unset."
    else
      msg.reply useful: true, "#{target.object.name} didn't have #{tag_name} set!"
    msg.finish()

# Stuck
  robot.commands.push 'bot stuck[ on <puzzle>][ because <reason>] - summons help and marks puzzle as stuck on the blackboard'
  robot.respond (rejoin 'stuck(?: on ',thingRE,')?(?: because ',thingRE,')?',/$/i), (msg) ->
    who = msg.envelope.user.id
    if msg.match[1]?
      target = callAs 'getByName', who,
        name: msg.match[1]
        optional_type: 'puzzles'
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    unless target.type is 'puzzles'
      msg.reply useful: true, 'Only puzzles can be stuck.'
      return msg.finish()
    result = callAs 'summon', who,
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
      target = callAs 'getByName', who,
        name: msg.match[1]
        optional_type: 'puzzles'
      if not target?
        msg.reply useful: true, "I don't know what \"#{msg.match[1]}\" is."
        return msg.finish()
    else
      target = objectFromRoom msg
      return unless target?
    unless target.type is 'puzzles'
      msg.reply useful: true, 'Only puzzles can be stuck.'
      return msg.finish()
    result = callAs 'unsummon', who,
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
    callAs 'announce', msg.envelope.user.id, "Announcement: #{msg.match[1]}"
    msg.finish()

  wordOrQuote = /([^\"\'\s]+|\"[^\"]+\"|\'[^\']+\')/

  robot.commands.push 'bot poll "Your question" "option 1" "option 2"...'
  robot.respond (rejoin 'poll ', wordOrQuote, '((?: ', wordOrQuote, ')+)', /$/i), (msg) ->
    optsRe = new RegExp rejoin(' ', wordOrQuote), 'g'
    opts = while m = optsRe.exec msg.match[2]
      strip m[1]
    if opts.length < 2 or opts.length > 5
      msg.reply useful: true, 'Must have between 2 and 5 options.'
      return msg.finish()
    callAs 'newPoll', msg.envelope.user.id, msg.envelope.room, strip(msg.match[1]), opts
    msg.finish()

  robot.commands.push 'bot global list - lists dynamic settings'
  robot.respond /global list$/i, (msg) ->
    for canon, setting of all_settings
      msg.priv useful: true, "#{setting.name}: #{setting.description}\nCurrent: '#{setting.get()}' Default: '#{setting.default}'"
    msg.finish()

  robot.commands.push 'bot global set <setting> to <value> - changes a dynamic setting'
  robot.respond (rejoin /global set /, thingRE, / to /, thingRE, /$/i), (msg) ->
    setting_name = strip msg.match[1]
    value = strip msg.match[2]
    setting = all_settings[canonical setting_name]
    unless setting?
      msg.reply useful: true, "Sorry, I don't know the setting '#{setting_name}'."
      return
    try
      impersonating msg.envelope.user.id, -> setting.set value
      msg.reply useful: true, "OK, set #{setting_name} to #{value}"
    catch error
      msg.reply useful: true, "Sorry, there was an error: #{error}"
