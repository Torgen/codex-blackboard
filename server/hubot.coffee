# Start a hubot, connected to our chat room.
'use strict'

import Robot from './imports/hubot.coffee'
import hubot_help from 'hubot-help'

# Log messages?
DEBUG = !Meteor.isProduction

BOTNAME = Meteor.settings?.botname or process.env.BOTNAME or 'Codexbot'
BOT_GRAVATAR = Meteor.settings?.botgravatar or process.env.BOTGRAVATAR or 'codex@printf.net'

return unless share.DO_BATCH_PROCESSING
Meteor.startup ->
  robot = new Robot BOTNAME, BOT_GRAVATAR
  # register scripts
  hubot_help robot.priv
  Object.keys(share.hubot).forEach (scriptName) ->
    console.log "Loading hubot script: #{scriptName}"
    share.hubot[scriptName](robot)
  robot.brain.emit('loaded')
  robot.run()
