'use strict'

import { Drive, FailDrive } from './imports/drive.coffee'
import DriveChangeWatcher from './imports/drive_change_polling.coffee'
import googleauth from './imports/googleauth.coffee'
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
    api = google.drive {version: 'v3', auth}
    share.drive = new Drive api
    console.log "Google Drive authorized and activated"
    if share.DO_BATCH_PROCESSING
      new DriveChangeWatcher api, share.drive.ringhuntersFolder
  catch error
    console.warn "Error trying to retrieve drive API:", error
    console.warn "Google Drive integration disabled."
    share.drive = new FailDrive
