'use strict'

import { Drive, FailDrive } from './imports/drive.coffee'
import { decrypt } from './imports/crypt.coffee'
import { google } from 'googleapis'

# helper functions to perform Google Drive operations

# Credentials
KEY = Meteor.settings.key or try
  Assets.getBinary 'drive-key.pem.crypt'
catch error
  undefined
if KEY? and Meteor.settings.password?
  # Decrypt the JWT authentication key synchronously at startup
  KEY = decrypt KEY, Meteor.settings.password
EMAIL = Meteor.settings.email or '571639156428@developer.gserviceaccount.com'
SCOPES = ['https://www.googleapis.com/auth/drive']

# Intialize APIs and load rootFolder
if Meteor.isAppTest
  share.drive = new FailDrive
  return
Promise.await do ->
  try
    auth = null
    if /^-----BEGIN RSA PRIVATE KEY-----/.test(KEY)
      auth = new google.auth.JWT(EMAIL, null, KEY, SCOPES)
      await auth.authorize()
    else
      auth = await google.auth.getClient scopes: SCOPES
    # record the API and auth info
    api = google.drive {version: 'v3', auth}
    share.drive = new Drive api
    console.log "Google Drive authorized and activated"
  catch error
    console.warn "Error trying to retrieve drive API:", error
    console.warn "Google Drive integration disabled."
    share.drive = new FailDrive
