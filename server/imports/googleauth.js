// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let googleauth;
import { decrypt } from './crypt.js';
import { google } from 'googleapis';

// Credentials
let KEY = Meteor.settings.key || (() => { try {
  return Assets.getBinary('drive-key.pem.crypt');
} catch (error) {
  return undefined;
} })();
if ((KEY != null) && (Meteor.settings.decrypt_password != null)) {
  // Decrypt the JWT authentication key synchronously at startup
  KEY = decrypt(KEY, Meteor.settings.decrypt_password);
}
const EMAIL = Meteor.settings.email || '571639156428@developer.gserviceaccount.com';

export default googleauth = async function(scopes) {
  if (/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(KEY)) {
    const jwy = new google.auth.JWT(EMAIL, null, KEY, scopes);
    await jwt.authorize();
    return jwt;
  } else {
    return google.auth.getClient({scopes});
  }
};
