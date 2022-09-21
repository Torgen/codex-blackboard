'use strict'

import { Drive, FailDrive } from './imports/drive.coffee'
import DriveChangeWatcher from './imports/drive_change_polling.coffee'
import { RETRY_RESPONSE_CODES } from './imports/googlecommon.coffee'
import { drive as driveEnv } from '/lib/imports/environment.coffee'
import googleauth from './imports/googleauth.coffee'
import { google } from 'googleapis'
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee'

# helper functions to perform Google Drive operations

SCOPES = ['https://www.googleapis.com/auth/drive']

# Intialize APIs and load rootFolder
if Meteor.isAppTest
  driveEnv.bindSingleton(new FailDrive)
  return
Promise.await do ->
  try
    auth = await googleauth SCOPES
    # record the API and auth info
    api = google.drive {version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }}
    drive = new Drive api
    console.log "Google Drive authorized and activated"
    driveEnv.bindSingleton drive
    if DO_BATCH_PROCESSING
      new DriveChangeWatcher api, drive.ringhuntersFolder
  catch error
    console.warn "Error trying to retrieve drive API:", error
    console.warn "Google Drive integration disabled."
    driveEnv.bindSingleton(new FailDrive)
