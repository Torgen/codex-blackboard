# set up object to store hubot scripts.
share.hubot = {}

share.botutil =
  # helper function: concat regexes
  rejoin: (regs...) ->
    [...,last] = regs
    flags = if last instanceof RegExp
        # use the flags of the last regexp, if there are any
        ( /\/([gimy]*)$/.exec last.toString() )?[1]
    else if typeof last is 'object'
        # use the flags property of the last object parameter
        regs.pop().flags
    return new RegExp( regs.reduce( (acc,r) ->
        acc + if r instanceof RegExp then r.source else r
    , '' ), flags ? '')

  # regexp for puzzle/round/group name, w/ optional quotes
  # don't allow empty strings to be things, that's just confusing
  # leading and trailing spaces should not be taken (unless in quotes)
  thingRE: /// (
    \"(?: [^\"\\] | \\\" )+\" |
    \'(?: [^\'\\] | \\\' )+\' |
    \S(?:.*?\S)?
    ) ///
  strip: (s) ->
    (try return JSON.parse(s)) if (/^[\"\']/.test s) and s[0] == s[s.length-1]
    s
  # helper function
  objectFromRoom: (msg) ->
    # get puzzle id from room name
    room = msg.envelope.room
    [type,id] = room.split('/', 2)
    if type is "general"
      msg.reply useful: true, "You need to tell me which puzzle this is for."
      msg.finish()
      return
    unless type is 'puzzles' or type is 'rounds'
      msg.reply useful: true, "I don't understand the type: #{type}."
      msg.finish()
      return
    object = Meteor.call "get", type, id
    unless object
      msg.reply useful: true, "Something went wrong.  I can't look up #{room}."
      msg.finish()
      return
    {type: type, object: object}