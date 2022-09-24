'use strict'

import { CalendarSync } from './imports/calendar.coffee'
import googleauth from './imports/googleauth.coffee'
import { RETRY_RESPONSE_CODES } from './imports/googlecommon.coffee'
import { google } from 'googleapis'
import { DO_BATCH_PROCESSING } from '/server/imports/batch.coffee'


SCOPES = ['https://www.googleapis.com/auth/calendar']

return unless DO_BATCH_PROCESSING
return if Meteor.isAppTest

Promise.await do ->
  try
    auth = await googleauth SCOPES
    api = google.calendar {version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }}
    new CalendarSync api
  catch e
    console.error e
