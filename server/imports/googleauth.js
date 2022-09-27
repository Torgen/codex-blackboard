import { decrypt } from "./crypt.js";
import { google } from "googleapis";

// Credentials
let KEY =
  Meteor.settings.key ||
  (() => {
    try {
      return Assets.getBinary("drive-key.pem.crypt");
    } catch (error) {
      return undefined;
    }
  })();
if (KEY != null && Meteor.settings.decrypt_password != null) {
  // Decrypt the JWT authentication key synchronously at startup
  KEY = decrypt(KEY, Meteor.settings.decrypt_password);
}
const EMAIL =
  Meteor.settings.email || "571639156428@developer.gserviceaccount.com";

export default async function (scopes) {
  if (/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(KEY)) {
    const jwt = new google.auth.JWT(EMAIL, null, KEY, scopes);
    await jwt.authorize();
    return jwt;
  } else {
    return google.auth.getClient({ scopes });
  }
}
