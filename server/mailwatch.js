'use strict'
# Watch an email account and announce new mail to general/0 chat.

# The account to watch is given in settings.json, like so:
# {
#   "watch": {
#     "username": "xxxxx@gmail.com",
#     "password": "yyyyy",
#     "host": "imap.gmail.com",
#     "port": 993,
#     "secure": true
#   }
# }
# To find the proper values for an email address, try the imap-autoconfig
# package.

import { MailListener } from 'mail-listener6'
import { newMessage } from './imports/newMessage.coffee'
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee'

watch = Meteor.settings?.watch ? {}
watch.username ?= process.env.MAILWATCH_USERNAME
watch.password ?= process.env.MAILWATCH_PASSWORD
watch.host ?= process.env.MAILWATCH_HOST ? 'imap.gmail.com'
watch.port ?= process.env.MAILWATCH_PORT ? 993
watch.tls ?= process.env.MAILWATCH_TLS ? true
watch.tlsOptions ?= if (tls_options_env = process.env.MAILWATCH_TLS_OPTIONS)? then EJSON.parse(tls_options_env) else { rejectUnauthorized: false }
watch.mailbox ?= process.env.MAILWATCH_MAILBOX ? 'INBOX'
watch.markSeen ?= process.env.MAILWATCH_MARK_SEEN ? true

return unless DO_BATCH_PROCESSING and watch.username and watch.password
mailListener = new MailListener
  username: watch.username
  password: watch.password
  host: watch.host
  port: watch.port
  tls: watch.tls
  tlsOptions: watch.tlsOptions
  mailbox: watch.mailbox
  markSeen: watch.markSeen
  fetchUnreadOnStart: false
  attachments: false

mailListener.on 'server:connected', ->
  console.log 'Watching for mail to', watch.username
mailListener.on 'error', (err) ->
  console.error 'IMAP error', err

mailListener.on 'mail', Meteor.bindEnvironment (mail) ->
  sender = mail.from.value[0]
  console.log sender
  mail_field =
    from_address: sender.address
    subject: mail.subject
  if sender.name?
    mail_field.from_name = sender.name

  console.log "Mail from #{mail.from.text} arrived:", mail.subject
  newMessage
    nick: sender.address
    room_name: 'general/0'
    body: mail.html ? mail.text
    bodyIsHtml: mail.html?
    bot_ignore: true
    mail:
      sender_name: sender.name ? ''
      subject: mail.subject

Meteor.startup ->
  mailListener.start()
