// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Watch an email account and announce new mail to general/0 chat.

// The account to watch is given in settings.json, like so:
// {
//   "watch": {
//     "username": "xxxxx@gmail.com",
//     "password": "yyyyy",
//     "host": "imap.gmail.com",
//     "port": 993,
//     "secure": true
//   }
// }
// To find the proper values for an email address, try the imap-autoconfig
// package.

import { MailListener } from 'mail-listener6';
import { newMessage } from './imports/newMessage.coffee';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee';

const watch = Meteor.settings?.watch ?? {};
if (watch.username == null) { watch.username = process.env.MAILWATCH_USERNAME; }
if (watch.password == null) { watch.password = process.env.MAILWATCH_PASSWORD; }
if (watch.host == null) { watch.host = process.env.MAILWATCH_HOST ?? 'imap.gmail.com'; }
if (watch.port == null) { watch.port = process.env.MAILWATCH_PORT ?? 993; }
if (watch.tls == null) { watch.tls = process.env.MAILWATCH_TLS ?? true; }
if (watch.tlsOptions == null) { let tls_options_env;
watch.tlsOptions = ((tls_options_env = process.env.MAILWATCH_TLS_OPTIONS) != null) ? EJSON.parse(tls_options_env) : { rejectUnauthorized: false }; }
if (watch.mailbox == null) { watch.mailbox = process.env.MAILWATCH_MAILBOX ?? 'INBOX'; }
if (watch.markSeen == null) { watch.markSeen = process.env.MAILWATCH_MARK_SEEN ?? true; }

if (!DO_BATCH_PROCESSING || !watch.username || !watch.password) { return; }
const mailListener = new MailListener({
  username: watch.username,
  password: watch.password,
  host: watch.host,
  port: watch.port,
  tls: watch.tls,
  tlsOptions: watch.tlsOptions,
  mailbox: watch.mailbox,
  markSeen: watch.markSeen,
  fetchUnreadOnStart: false,
  attachments: false
});

mailListener.on('server:connected', () => console.log('Watching for mail to', watch.username));
mailListener.on('error', err => console.error('IMAP error', err));

mailListener.on('mail', Meteor.bindEnvironment(function(mail) {
  const sender = mail.from.value[0];
  console.log(sender);
  const mail_field = {
    from_address: sender.address,
    subject: mail.subject
  };
  if (sender.name != null) {
    mail_field.from_name = sender.name;
  }

  console.log(`Mail from ${mail.from.text} arrived:`, mail.subject);
  return newMessage({
    nick: sender.address,
    room_name: 'general/0',
    body: mail.html ?? mail.text,
    bodyIsHtml: (mail.html != null),
    bot_ignore: true,
    mail: {
      sender_name: sender.name ?? '',
      subject: mail.subject
    }
  });
})
);

Meteor.startup(() => mailListener.start());
