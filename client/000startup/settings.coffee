# This file contains various constants used throughout the client code.
'use strict'
settings = share.settings = {}

# this is populated on the client based on the server's --settings
server = Meteor.settings?.public ? {}

# identify this particular client instance
settings.CLIENT_UUID = Random.id()

# used to create gravatars from nicks
settings.DEFAULT_HOST = server.defaultHost ? 'codexian.us'

settings.TEAM_NAME = server.teamName ? 'Codex'

settings.GENERAL_ROOM_NAME = server.chatName ? 'Ringhunters'

settings.NAME_PLACEHOLDER = server.namePlaceholder ? 'J. Random Codexian'

settings.WHOSE_GITHUB = server.whoseGitHub ? 'cjb'

settings.INITIAL_CHAT_LIMIT = server.initialChatLimit ? 200

settings.CHAT_LIMIT_INCREMENT = server.chatLimitIncrement ? 100

# -- Performance settings --

# make fewer people subscribe to ringhunters chat.
settings.BB_DISABLE_RINGHUNTERS_HEADER = server.disableRinghunters ? false

# subscribe to all rounds/all puzzles, or try to be more granular?
settings.BB_SUB_ALL = server.subAll ? true

# disable PMs (more efficient queries if PMs are disabled)
# (PMs are always allows in ringhunters)
settings.BB_DISABLE_PM = server.disablePM ? false

# Set to 'none' to have no followup rendering.
settings.FOLLOWUP_STYLE = server.followupStyle ? 'js'

settings.PICKER_CLIENT_ID = server.picker?.clientId
settings.PICKER_APP_ID = server.picker?.appId
settings.PICKER_DEVELOPER_KEY = server.picker?.developerKey
