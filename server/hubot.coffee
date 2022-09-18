# Start a hubot, connected to our chat room.
'use strict'

return unless share.DO_BATCH_PROCESSING

import { scripts } from '/server/imports/botutil.coffee'
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
  robot.privately hubot_help
  robot.loadExternalScripts EXTERNAL_SCRIPTS
  for name, script of scripts
    continue if name in SKIP_SCRIPTS
    console.log "Loading hubot script: #{name}"
    script(robot)
  
  robot.run()
