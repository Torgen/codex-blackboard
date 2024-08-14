import { decrypt } from "./crypt.js";
import { GoogleAuth, JWT } from "google-auth-library";

// Credentials
const EMAIL =
  Meteor.settings.email || "571639156428@developer.gserviceaccount.com";

export default async function (scopes) {
  let KEY = Meteor.settings.key;
  if (!KEY) {
    try {
      KEY = await Assets.getBinaryAsync("drive-key.pem.crypt");
    } catch (error) {
    }
  }
  if (KEY != null && Meteor.settings.decrypt_password != null) {
    // Decrypt the JWT authentication key synchronously at startup
    KEY = decrypt(KEY, Meteor.settings.decrypt_password);
  }
  if (/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(KEY)) {
    const jwt = new JWT({email: EMAIL, key: KEY, scopes});
    await jwt.authorize();
    return jwt;
  } else {
    return await new GoogleAuth({ scopes }).getClient();
  }
}
