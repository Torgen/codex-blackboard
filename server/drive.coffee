'use strict'

import { Drive, FailDrive } from '/server/imports/drive.coffee'
import DriveChangeWatcher from '/server/imports/drive_change_polling.coffee'
import { RETRY_RESPONSE_CODES } from '/server/imports/googlecommon.coffee'
import googleauth from '/server/imports/googleauth.coffee'
import { google } from 'googleapis'

# helper functions to perform Google Drive operations

SCOPES = ['https://www.googleapis.com/auth/drive']

# Intialize APIs and load rootFolder
if Meteor.isAppTest
  share.drive = new FailDrive
  return
Promise.await do ->
  try
    auth = await googleauth SCOPES
    # record the API and auth info
    api = google.drive {version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }}
    share.drive = new Drive api
    console.log "Google Drive authorized and activated"
    if share.DO_BATCH_PROCESSING
      new DriveChangeWatcher api, share.drive.ringhuntersFolder
  catch error
    console.warn "Error trying to retrieve drive API:", error
    console.warn "Google Drive integration disabled."
    share.drive = new FailDrive
