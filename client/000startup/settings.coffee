# This file contains various constants used throughout the client code.
'use strict'
settings = share.settings = {}

# this is populated on the client based on the server's --settings
server = Meteor.settings?.public ? {}

# identify this particular client instance
settings.CLIENT_UUID = Random.id()

# used to create gravatars from nicks
settings.DEFAULT_HOST = server.defaultHost ? 'codexian.us'

# -- Performance settings --

# make fewer people subscribe to ringhunters chat.
settings.BB_DISABLE_RINGHUNTERS_HEADER = server.disableRinghunters ? false

# subscribe to all rounds/all puzzles, or try to be more granular?
settings.BB_SUB_ALL = server.subAll ? true

# disable PMs (more efficient queries if PMs are disabled)
# (PMs are always allows in ringhunters)
settings.BB_DISABLE_PM = server.disablePM ? false

# use the old client-side followup formatting, which slows down client
# render speed.  this has been replaced by server-side followup
# detection... but we're leaving the code in place just in case
# the server-side code becomes a performance issue.
# (Note that server-side followups will occassionally not label
# a followup because a PM (invisible to you) intervened between
# two messages.  The (slow) client-side followups look specifically
# at messages visible to you, so don't have this issue.)
settings.SLOW_CHAT_FOLLOWUPS = server.slowChatFollowups ? false

settings.PICKER_CLIENT_ID = server.picker?.clientId
settings.PICKER_APP_ID = server.picker?.appId
settings.PICKER_DEVELOPER_KEY = server.picker?.developerKey
