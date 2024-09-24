import { CalendarSync } from "./imports/calendar.js";
import googleauth from "./imports/googleauth.js";
import { RETRY_RESPONSE_CODES } from "./imports/googlecommon.js";
import { calendar } from "@googleapis/calendar";
import { DO_BATCH_PROCESSING } from "/server/imports/batch.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

if (DO_BATCH_PROCESSING && !Meteor.isAppTest) {
  Meteor.startup(async function () {
    try {
      const auth = await googleauth(SCOPES);
      const api = calendar({
        version: "v3",
        auth,
        retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES },
      });
      const sync = new CalendarSync(api);
      await sync.start();
    } catch (e) {
      console.error(e);
    }
  });
}
