'use strict'

DEFAULT_ROOT_FOLDER_NAME = "MIT Mystery Hunt #{new Date().getFullYear()}"
export ROOT_FOLDER_NAME = -> Meteor.settings.folder or process.env.DRIVE_ROOT_FOLDER or DEFAULT_ROOT_FOLDER_NAME
export CODEX_ACCOUNT = -> Meteor.settings.driveowner or process.env.DRIVE_OWNER_ADDRESS
export SHARE_GROUP = -> Meteor.settings.drive_share_group or process.env.DRIVE_SHARE_GROUP

# Because sometimes user rate limits are 403 instead of 429, we have to retry them.
export RETRY_RESPONSE_CODES = [[100,199], [403,403], [429,429], [500,599]]