# This file contains various constants used throughout the client code.
'use strict'

# this is populated on the client based on the server's --settings
server = Meteor.settings?.public ? {}

# identify this particular client instance
export CLIENT_UUID = Random.id()

# used to create gravatars from nicks
export DEFAULT_HOST = server.defaultHost ? 'codexian.us'

export TEAM_NAME = server.teamName ? 'Codex'

export GENERAL_ROOM_NAME = server.chatName ? 'Ringhunters'

export NAME_PLACEHOLDER = server.namePlaceholder ? 'J. Random Codexian'

export WHOSE_GITHUB = server.whoseGitHub ? 'cjb'

export INITIAL_CHAT_LIMIT = server.initialChatLimit ? 200

export CHAT_LIMIT_INCREMENT = server.chatLimitIncrement ? 100

# Used to generate video chat links
# No default; if unset, don't generate links.
export JITSI_SERVER = server.jitsi?.server ? server.jitsiServer

# -- Performance settings --

# make fewer people subscribe to ringhunters chat.
export BB_DISABLE_RINGHUNTERS_HEADER = server.disableRinghunters ? false

# disable PMs (more efficient queries if PMs are disabled)
# (PMs are always allows in ringhunters)
export BB_DISABLE_PM = server.disablePM ? false

# Set to 'none' to have no followup rendering.
export FOLLOWUP_STYLE = server.followupStyle ? 'js'

export MAPS_API_KEY = server.mapsApiKey
