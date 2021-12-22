'use strict'

export ROOT_FOLDER_NAME = -> Meteor.settings.folder or process.env.DRIVE_ROOT_FOLDER or DEFAULT_ROOT_FOLDER_NAME
export CODEX_ACCOUNT = -> Meteor.settings.driveowner or process.env.DRIVE_OWNER_ADDRESS
export SHARE_GROUP = -> Meteor.settings.drive_share_group or process.env.DRIVE_SHARE_GROUP