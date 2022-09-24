// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Drive, FailDrive } from './imports/drive.coffee';
import DriveChangeWatcher from './imports/drive_change_polling.coffee';
import { RETRY_RESPONSE_CODES } from './imports/googlecommon.coffee';
import { drive as driveEnv } from '/lib/imports/environment.coffee';
import googleauth from './imports/googleauth.coffee';
import { google } from 'googleapis';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee';

// helper functions to perform Google Drive operations

const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Intialize APIs and load rootFolder
if (Meteor.isAppTest) {
  driveEnv.bindSingleton(new FailDrive);
  return;
}
Promise.await((async function() {
  try {
    const auth = await googleauth(SCOPES);
    // record the API and auth info
    const api = google.drive({version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }});
    const drive = new Drive(api);
    console.log("Google Drive authorized and activated");
    driveEnv.bindSingleton(drive);
    if (DO_BATCH_PROCESSING) {
      return new DriveChangeWatcher(api, drive.ringhuntersFolder);
    }
  } catch (error) {
    console.warn("Error trying to retrieve drive API:", error);
    console.warn("Google Drive integration disabled.");
    return driveEnv.bindSingleton(new FailDrive);
  }
}
)());
