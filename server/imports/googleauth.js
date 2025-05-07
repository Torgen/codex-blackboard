import { GoogleAuth, JWT } from "google-auth-library";

// Credentials
const EMAIL = Meteor.settings.email;

export default async function (scopes) {
  let KEY = Meteor.settings.key;
  if (/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(KEY)) {
    const jwt = new JWT({ email: EMAIL, key: KEY, scopes });
    await jwt.authorize();
    return jwt;
  } else {
    return await new GoogleAuth({ scopes }).getClient();
  }
}
