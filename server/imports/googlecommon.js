const DEFAULT_ROOT_FOLDER_NAME = `MIT Mystery Hunt ${new Date().getFullYear()}`;
export const ROOT_FOLDER_NAME = () =>
  Meteor.settings.folder ||
  process.env.DRIVE_ROOT_FOLDER ||
  DEFAULT_ROOT_FOLDER_NAME;
export const CODEX_ACCOUNT = () =>
  Meteor.settings.driveowner || process.env.DRIVE_OWNER_ADDRESS;
export const SHARE_GROUP = () =>
  Meteor.settings.drive_share_group || process.env.DRIVE_SHARE_GROUP;

// Because sometimes user rate limits are 403 instead of 429, we have to retry them.
export const RETRY_RESPONSE_CODES = [
  [100, 199],
  [403, 403],
  [429, 429],
  [500, 599],
];
