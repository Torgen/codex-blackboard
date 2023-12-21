import { Drive, FailDrive } from "./imports/drive.js";
import DriveChangeWatcher from "./imports/drive_change_polling.js";
import { RETRY_RESPONSE_CODES } from "./imports/googlecommon.js";
import { drive as driveEnv } from "/lib/imports/environment.js";
import googleauth from "./imports/googleauth.js";
import { google } from "googleapis";
import { DO_BATCH_PROCESSING } from "/server/imports/batch.js";

// helper functions to perform Google Drive operations

const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Intialize APIs and load rootFolder
if (Meteor.isAppTest) {
  driveEnv.bindSingleton(new FailDrive());
} else {
  Promise.await(
    (async function () {
      try {
        const auth = await googleauth(SCOPES);
        // record the API and auth info
        const api = google.drive({
          version: "v3",
          auth,
          retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES },
        });
        const drive = new Drive(api);
        console.log("Google Drive authorized and activated");
        driveEnv.bindSingleton(drive);
        if (DO_BATCH_PROCESSING) {
          new DriveChangeWatcher(api, drive.ringhuntersFolder);
        }
      } catch (error) {
        console.warn("Error trying to retrieve drive API:", error);
        console.warn("Google Drive integration disabled.");
        driveEnv.bindSingleton(new FailDrive());
      }
    })(),
  );
}
