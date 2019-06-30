
import {rejoin, strip, thingRE, objectFromRoom, puzzleOrThis } from '../imports/botutil.coffee'
import { callAs } from '../imports/impersonate.coffee'

makeMeta = (msg) ->
  name = msg.match[1]
  p = puzzleOrThis(name, msg)
  if not p
    return if msg.message.done
    msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
    msg.finish()
    return
  who = msg.envelope.user.id
  if callAs 'makeMeta', who, p.object._id
    msg.reply useful: true, "OK, #{name} is now a meta."
  else
    msg.reply useful: true, "#{name} was already a meta."
  msg.finish()

makeNotMeta = (msg) ->
  name = msg.match[1]
  p = puzzleOrThis(name, msg)
  if not p
    return if msg.message.done
    msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
    msg.finish()
    return
  l = p.object.puzzles?.length
  if l
    msg.reply useful: true, "#{l} puzzle#{if l isnt 1 then 's' else ''} feed#{if l is 1 then 's' else ''} into #{p.object.name}. It must be a meta."
    msg.finish()
    return
  who = msg.envelope.user.id
  if callAs 'makeNotMeta', who, p.object._id
    msg.reply useful: true, "OK, #{name} is no longer a meta."
  else
    msg.reply useful: true, "#{name} already wasn't a meta."
  msg.finish()

share.hubot.metas = (robot) ->
  robot.commands.push 'bot <puzzle|this> is a meta[puzzle] - Updates codex blackboard'
  robot.respond (rejoin thingRE, / is a meta(puzzle)?$/i), makeMeta

  robot.commands.push 'bot make <puzzle|this> a meta[puzzle] - Updates codex blackboard'
  robot.respond (rejoin /make /, thingRE, / a meta(puzzle)?$/i), makeMeta

  robot.commands.push 'bot <puzzle|this> isn\'t a meta[puzzle] - Updates codex blackboard'
  robot.respond (rejoin thingRE, / is(n't| not) a meta(puzzle)?$/i), makeNotMeta

  robot.commands.push 'bot <puzzle|this> feeds into <puzzle|this> - Update codex blackboard'
  robot.respond (rejoin thingRE, / feeds into /, thingRE, /$/i), (msg) ->
    puzzName = msg.match[1]
    metaName = msg.match[2]
    p = puzzleOrThis(puzzName, msg)
    return unless p?
    m = puzzleOrThis(metaName, msg)
    return unless m?
    who = msg.envelope.user.id
    if callAs 'feedMeta', who, p.object._id, m.object._id
      msg.reply useful: true, "OK, #{puzzName} now feeds into #{metaName}."
    else
      msg.reply useful:true, "#{puzzName} already fed into #{metaName}."
    msg.finish()

  robot.commands.push 'bot <puzzle|this> doesn\'t feed into <puzzle|this> - Update codex blackboard'
  robot.respond (rejoin thingRE, / does(n't| not) feed into /, thingRE, /$/i), (msg) ->
    puzzName = msg.match[1]
    metaName = msg.match[3]
    p = puzzleOrThis(puzzName, msg)
    return unless p?
    m = puzzleOrThis(metaName, msg)
    return unless m?
    who = msg.envelope.user.id
    if callAs 'unfeedMeta', who, p.object._id, m.object._id
      msg.reply useful: true, "OK, #{puzzName} no longer feeds into #{metaName}."
    else
      msg.reply useful:true, "#{puzzName} already didn't feed into #{metaName}."
    msg.finish()