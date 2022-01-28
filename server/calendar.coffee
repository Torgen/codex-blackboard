'use strict'

import { CalendarSync } from '/server/imports/calendar.coffee'
import googleauth from '/server/imports/googleauth.coffee'
import { RETRY_RESPONSE_CODES } from '/server/imports/googlecommon.coffee'
import { google } from 'googleapis'


SCOPES = ['https://www.googleapis.com/auth/calendar']

return unless share.DO_BATCH_PROCESSING
return if Meteor.isAppTest

Promise.await do ->
  try
    auth = await googleauth SCOPES
    api = google.calendar {version: 'v3', auth, retryConfig: { statusCodesToRetry: RETRY_RESPONSE_CODES }}
    new CalendarSync api
  catch e
    console.error e
