/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { scripts } from '/server/imports/botutil.coffee';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee';
import Robot from './imports/hubot.coffee';
import hubot_help from 'hubot-help';
// Required so external hubot scripts written in coffeescript can be loaded
// dynamically.
import 'coffeescript/register';

if (!DO_BATCH_PROCESSING) { return; }

// Log messages?
const DEBUG = !Meteor.isProduction;

const BOTNAME = Meteor.settings?.botname || process.env.BOTNAME || 'Codexbot';
const BOT_GRAVATAR = Meteor.settings?.botgravatar || process.env.BOTGRAVATAR || 'codex@printf.net';

const SKIP_SCRIPTS = Meteor.settings?.skip_scripts ?? process.env.SKIP_SCRIPTS?.split(',') ?? [];
const EXTERNAL_SCRIPTS = Meteor.settings?.external_scripts ?? process.env.EXTERNAL_SCRIPTS?.split(',') ?? [];

Meteor.startup(function() {
  const robot = new Robot(BOTNAME, BOT_GRAVATAR);
  // register scripts
  robot.privately(hubot_help);
  robot.loadExternalScripts(EXTERNAL_SCRIPTS);
  for (let name in scripts) {
    const script = scripts[name];
    if (SKIP_SCRIPTS.includes(name)) { continue; }
    console.log(`Loading hubot script: ${name}`);
    script(robot);
  }
  
  return robot.run();
});
