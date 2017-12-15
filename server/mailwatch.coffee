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

watch = Meteor.settings?.watch ? {}
watch.username ?= process.env.MAILWATCH_USERNAME
watch.password ?= process.env.MAILWATCH_PASSWORD
watch.host ?= process.env.MAILWATCH_HOST ? 'imap.gmail.com'
watch.port ?= process.env.MAILWATCH_PORT ? 993
watch.tls ?= process.env.MAILWATCH_TLS ? true
watch.tlsOptions ?= if (tls_options_env = process.env.MAILWATCH_TLS_OPTIONS)? then EJSON.parse(tls_options_env) else { rejectUnauthorized: false }
watch.mailbox ?= process.env.MAILWATCH_MAILBOX ? 'INBOX'
watch.markSeen ?= process.env.MAILWATCH_MARK_SEEN ? true
watch.mailParserOptions = if (mailparser_options_env = process.env.MAILWATCH_MAILPARSER_OPTIONS)? then EJSON.parse(mailparser_options_env) else { streamAttachments: true }

return unless share.model.DO_BATCH_PROCESSING and watch.username and watch.password
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
  mailParserOptions: watch.mailParserOptions

mailListener.on 'server:connected', ->
  console.log 'Watching for mail to', watch.username
mailListener.on 'error', (err) ->
  console.error 'IMAP error', err

mailListener.on 'mail', (mail) ->
  # mail arrived! fields:
  #  text -- body plaintext
  #  html -- optional field, contains body formatted as HTML
  #  headers -- hash, with 'sender', 'date', 'subject', 'from', 'to' (unparsed)
  #  subject, messageId, priority
  #  from -- array of objects with 'address' and 'name' fields
  #  to -- same as from
  #  attachements -- an array of objects with various fields
  console.log 'Mail from HQ arrived:', mail.subject
  Meteor.call 'newMessage',
    nick: 'thehunt'
    action: true
    body: "sent mail: #{mail.subject}"
    bot_ignore: true
  Meteor.call 'newMessage',
    nick: 'thehunt'
    body: mail.html ? mail.text
    bodyIsHtml: mail.html?
    bot_ignore: true

Meteor.startup ->
  mailListener.start()
