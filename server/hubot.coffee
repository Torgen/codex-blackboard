# Start a hubot, connected to our chat room.
'use strict'

return unless share.DO_BATCH_PROCESSING

import Robot from './imports/hubot.coffee'
import hubot_help from 'hubot-help'
# Required so external hubot scripts written in coffeescript can be loaded
# dynamically.
import 'coffeescript/register'

# Log messages?
DEBUG = !Meteor.isProduction

BOTNAME = Meteor.settings?.botname or process.env.BOTNAME or 'Codexbot'
BOT_GRAVATAR = Meteor.settings?.botgravatar or process.env.BOTGRAVATAR or 'codex@printf.net'

SKIP_SCRIPTS = Meteor.settings?.skip_scripts ? process.env.SKIP_SCRIPTS?.split(',') ? []
EXTERNAL_SCRIPTS = Meteor.settings?.external_scripts ? process.env.EXTERNAL_SCRIPTS?.split(',') ? []

Meteor.startup ->
  robot = new Robot BOTNAME, BOT_GRAVATAR
  # register scripts
  hubot_help robot.priv
  robot.loadExternalScripts EXTERNAL_SCRIPTS
  delete share.hubot[script] for script in SKIP_SCRIPTS
  Object.keys(share.hubot).forEach (scriptName) ->
    console.log "Loading hubot script: #{scriptName}"
    share.hubot[scriptName](robot)

  robot.brain.emit('loaded')
  robot.run()
