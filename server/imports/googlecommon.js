const DEFAULT_ROOT_FOLDER_NAME = `MIT Mystery Hunt ${new Date().getFullYear()}`;
export var ROOT_FOLDER_NAME = () => Meteor.settings.folder || process.env.DRIVE_ROOT_FOLDER || DEFAULT_ROOT_FOLDER_NAME;
export var CODEX_ACCOUNT = () => Meteor.settings.driveowner || process.env.DRIVE_OWNER_ADDRESS;
export var SHARE_GROUP = () => Meteor.settings.drive_share_group || process.env.DRIVE_SHARE_GROUP;

// Because sometimes user rate limits are 403 instead of 429, we have to retry them.
export var RETRY_RESPONSE_CODES = [[100,199], [403,403], [429,429], [500,599]];