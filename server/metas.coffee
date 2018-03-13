puzzleOrThis = (s, msg) ->
  return share.botutil.objectFromRoom(msg) if s is 'this'
  p = Meteor.call "getByName",
    name: s
    optional_type: 'puzzles'
  return p if p?
  msg.reply useful: true, "I can't find a puzzle called \"#{s}\"."
  msg.finish()
  return null
  

makeMeta = (msg) ->
  name = msg.match[1]
  p = puzzleOrThis(name, msg)
  if not p
    return if msg.done
    msg.reply useful: true, "I can't find a puzzle called \"#{name}\"."
    msg.finish()
    return
  if Meteor.call 'makeMeta', p.object._id
    msg.reply useful: true, "OK, #{name} is now a meta."
  else
    msg.reply useful: true, "#{name} was already a meta."
  msg.finish()

makeNotMeta = (msg) ->
  name = msg.match[1]
  p = puzzleOrThis(name, msg)
  return unless p?
  if Meteor.call 'makeNotMeta', p.object._id
    msg.reply useful: true, "OK, #{name} is no longer a meta."
  else
    msg.reply useful: true, "#{name} already wasn't a meta."
  msg.finish()

share.hubot.metas = (robot) ->
  robot.commands.push 'bot <puzzle|this> is a meta[puzzle] - Updates codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE, / is a meta(puzzle)?$/i), makeMeta

  robot.commands.push 'bot make <puzzle|this> a meta[puzzle] - Updates codex blackboard'
  robot.respond (share.botutil.rejoin /make /, share.botutil.thingRE, / a meta(puzzle)?$/i), makeMeta

  robot.commands.push 'bot <puzzle|this> isn\'t a meta[puzzle] - Updates codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE, / is(n't| not) a meta(puzzle)?$/i), makeNotMeta

  robot.commands.push 'bot <puzzle|this> feeds into <puzzle|this> - Update codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE, / feeds into /, share.botutil.thingRE, /$/i), (msg) ->
    puzzName = msg.match[1]
    metaName = msg.match[2]
    p = puzzleOrThis(puzzName, msg)
    return unless p?
    m = puzzleOrThis(metaName, msg)
    return unless m?
    if Meteor.call 'feedMeta', p.object._id, m.object._id
      msg.reply useful: true, "OK, #{puzzName} now feeds into #{metaName}."
    else
      msg.reply useful:true, "#{puzzName} already fed into #{metaName}."
    msg.finish()

  robot.commands.push 'bot <puzzle|this> doesn\'t feed into <puzzle|this> - Update codex blackboard'
  robot.respond (share.botutil.rejoin share.botutil.thingRE, / does(n't| not) feed into /, share.botutil.thingRE, /$/i), (msg) ->
    puzzName = msg.match[1]
    metaName = msg.match[3]
    p = puzzleOrThis(puzzName, msg)
    return unless p?
    m = puzzleOrThis(metaName, msg)
    return unless m?
    if Meteor.call 'unfeedMeta', p.object._id, m.object._id
      msg.reply useful: true, "OK, #{puzzName} no longer feeds into #{metaName}."
    else
      msg.reply useful:true, "#{puzzName} already didn't feed into #{metaName}."
    msg.finish()