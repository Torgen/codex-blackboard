'use strict'

# Will access contents via share
import '/lib/model.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import delay from 'delay'
import { waitForDocument } from '/lib/imports/testutils.coffee'
import DriveChangeWatcher, {startPageTokens, driveFiles} from  './drive_change_polling.coffee'

model = share.model

SPREADSHEET_TYPE = 'application/vnd.google-apps.spreadsheet'
DOC_TYPE = 'application/vnd.google-apps.document'

describe 'drive change polling', ->
  @timeout 10000

  clock = null
  api = null
  changes = null
  poller = null

  beforeEach ->
    resetDatabase()
    clock = sinon.useFakeTimers
      now: 60007
      toFake: ['setTimeout', 'clearTimeout', 'Date']
      
    api =
      changes:
        list: ->
        getStartPageToken: ->
    changes = sinon.mock(api.changes)

  afterEach ->
    console.log 'about to stop poller'
    poller?.stop()
    console.log 'about to restore clock'
    clock.restore()
    # Meteor uses underlying setTimeout for stuff, so you have to run any leftover timeouts
    # or it can break later tests.
    console.log 'about to run all callbacks'
    clock.runAll()
    console.log 'done'

  afterEach ->
    sinon.verifyAndRestore()

  it 'fetches page token when never polled', ->
    changes.expects('getStartPageToken').once().resolves data: startPageToken: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    chai.assert.include startPageTokens.findOne(),
      timestamp: 60007
      token: 'firstPage'

  it 'polls immediately when poll is overdue', ->
    startPageTokens.insert
      timestamp: 7
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: []
    clock.tick(0)
    chai.assert.include startPageTokens.findOne(),
      timestamp: 60007
      token: 'secondPage'

  it 'waits to poll', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: []
    clock.tick(30000)
    chai.assert.include startPageTokens.findOne(),
      timestamp: 90007
      token: 'secondPage'

  it 'updates puzzle and does not announce when spreadsheet updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    puzz = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      drive: 'foo_drive'
      doc: 'foo_doc'
      spreadsheet: 'foo_sheet'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_sheet'
        file:
          name: 'Worksheet: Foo'
          mimeType: SPREADSHEET_TYPE
          parents: ['foo_drive']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.include model.Puzzles.findOne(canon: 'foo'),
      drive_touched: 31006
    chai.assert.isUndefined model.Messages.findOne()

  it 'updates puzzle and does not announce when doc updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    puzz = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      drive: 'foo_drive'
      doc: 'foo_doc'
      spreadsheet: 'foo_sheet'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_doc'
        file:
          name: 'Notes: Foo'
          mimeType: DOC_TYPE
          parents: ['foo_drive']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.include model.Puzzles.findOne(canon: 'foo'),
      drive_touched: 31006
    chai.assert.isUndefined model.Messages.findOne()

  it 'updates puzzle and announces when new file updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    puzz = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      drive: 'foo_drive'
      doc: 'foo_doc'
      spreadsheet: 'foo_sheet'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['foo_drive']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.include model.Puzzles.findOne(canon: 'foo'),
      drive_touched: 31006
    chai.assert.include driveFiles.findOne('foo_other'),
      announced: 60007
    chai.assert.deepInclude model.Messages.findOne(),
      room_name: "puzzles/#{puzz}"
      system: true
      file_upload:
        mimeType: 'image/svg+xml'
        webViewLink: 'https://blahblahblah.com'
        name: 'Drawing about Foo'
        fileId: 'foo_other'

  it 'updates puzzle and does not announce when announced file updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    driveFiles.insert
      _id: 'foo_other'
      announced: 5
    puzz = model.Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      drive: 'foo_drive'
      doc: 'foo_doc'
      spreadsheet: 'foo_sheet'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['foo_drive']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.include model.Puzzles.findOne(canon: 'foo'),
      drive_touched: 31006
    chai.assert.isUndefined model.Messages.findOne()

  it 'announces in general chat when new file updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['root_folder']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.include driveFiles.findOne('foo_other'),
      announced: 60007
    chai.assert.deepInclude model.Messages.findOne(),
      room_name: 'general/0'
      system: true
      file_upload:
        mimeType: 'image/svg+xml'
        webViewLink: 'https://blahblahblah.com'
        name: 'Drawing about Foo'
        fileId: 'foo_other'

  it 'does not announce in general chat when announced file updated', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    driveFiles.insert
      _id: 'foo_other'
      announced: 5
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['root_folder']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.isUndefined model.Messages.findOne()

  it 'does not announce when new file updated in unknown folder', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    changes.expects('list').once().withArgs(sinon.match pageToken: 'firstPage').resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['somewhere_else']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.isUndefined model.Messages.findOne()

# Test when initial poll fails, polls are rescheduled

  it 'calls again with next page token', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    list = changes.expects('list').twice().onFirstCall().resolves(data:
      nextPageToken: 'continue'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['root_folder']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    ).onSecondCall().resolves data:
      newStartPageToken: 'secondPage'
      changes: [
        changeType: 'file'
        fileId: 'unknown_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['somewhere_else']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    poller.poll()
    chai.assert.deepInclude model.Messages.findOne(),
      room_name: 'general/0'
      system: true
      file_upload:
        mimeType: 'image/svg+xml'
        webViewLink: 'https://blahblahblah.com'
        name: 'Drawing about Foo'
        fileId: 'foo_other'
    chai.assert.include list.getCall(0).args[0],
      pageToken: 'firstPage'
    chai.assert.include list.getCall(1).args[0],
      pageToken: 'continue'
    chai.assert.include startPageTokens.findOne(),
      timestamp: 60007
      token: 'secondPage'

  it 'does not announce when failure on next page token', ->
    startPageTokens.insert
      timestamp: 30007
      token: 'firstPage'
    poller = new DriveChangeWatcher api, 'root_folder'
    list = changes.expects('list').twice().onFirstCall().resolves(data:
      nextPageToken: 'continue'
      changes: [
        changeType: 'file'
        fileId: 'foo_other'
        file:
          name: 'Drawing about Foo'
          mimeType: 'image/svg+xml'
          parents: ['root_folder']
          createdTime: '1970-01-01T00:00:31.006Z'
          modifiedTime: '1970-01-01T00:00:31.006Z'
          webViewLink: 'https://blahblahblah.com'
      ]
    ).onSecondCall().rejects 'error'
    poller.poll()
    chai.assert.isUndefined model.Messages.findOne()
    chai.assert.include list.getCall(0).args[0],
      pageToken: 'firstPage'
    chai.assert.include list.getCall(1).args[0],
      pageToken: 'continue'
    chai.assert.include startPageTokens.findOne(),
      timestamp: 30007
      token: 'firstPage'
