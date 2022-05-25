
import { newMessage} from '/server/imports/newMessage.coffee'
import { NonEmptyString } from '/lib/imports/match.coffee'

Meteor.methods
  newMessage: (args) ->
    check @userId, NonEmptyString
    check args,
      body: Match.Optional String
      bodyIsHtml: Match.Optional Boolean
      action: Match.Optional Boolean
      to: Match.Optional NonEmptyString
      room_name: Match.Optional NonEmptyString
      useful: Match.Optional Boolean
      bot_ignore: Match.Optional Boolean
      on_behalf: Match.Optional Boolean
      header_ignore: Match.Optional Boolean
      suppressLastRead: Match.Optional Boolean
      mention: Match.Optional [String]
    suppress = args.suppressLastRead
    delete args.suppressLastRead
    newMsg = {args..., nick: @userId}
    newMsg.body ?= ''
    newMsg.room_name ?= "general/0"
    newMsg = newMessage newMsg
    # update the user's 'last read' message to include this one
    # (doing it here allows us to use server timestamp on message)
    unless suppress
      Meteor.call 'updateLastRead',
        room_name: newMsg.room_name
        timestamp: newMsg.timestamp
    newMsg