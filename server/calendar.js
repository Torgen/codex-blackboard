/*
 * decaffeinate suggestions:
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { CalendarSync } from './imports/calendar.coffee';
import googleauth from './imports/googleauth.coffee';
import { RETRY_RESPONSE_CODES } from './imports/googlecommon.coffee';
import { google } from 'googleapis';
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee';


const SCOPES = ['https://www.googleapis.com/auth/calendar'];

if (!DO_BATCH_PROCESSING) { return; }
if (Meteor.isAppTest) { return; }

Promise.await((async function() {
  try {
    const auth = await googleauth(SCOPES);
    const api = google.calendar({version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }});
    return new CalendarSync(api);
  } catch (e) {
    return console.error(e);
  }
}
)());
