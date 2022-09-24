'use strict'

import { decrypt } from './crypt.coffee'
import { google } from 'googleapis'

# Credentials
KEY = Meteor.settings.key or try
  Assets.getBinary 'drive-key.pem.crypt'
catch error
  undefined
if KEY? and Meteor.settings.decrypt_password?
  # Decrypt the JWT authentication key synchronously at startup
  KEY = decrypt KEY, Meteor.settings.decrypt_password
EMAIL = Meteor.settings.email or '571639156428@developer.gserviceaccount.com'

export default googleauth = (scopes) ->
  if /^-----BEGIN (RSA )?PRIVATE KEY-----/.test(KEY)
    jwy = new google.auth.JWT(EMAIL, null, KEY, scopes)
    await jwt.authorize()
    return jwt
  else
    return google.auth.getClient {scopes}
