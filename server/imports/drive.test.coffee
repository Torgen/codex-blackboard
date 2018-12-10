'use strict'

import '../000batch.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { Drive } from './drive.coffee'

GIVEN_OWNER_PERM =
  withLink: false
  role: 'writer'
  type: 'user'
  value: 'dan@ros.art'

RECEIVED_OWNER_PERM = 
  withLink: false
  role: 'writer'
  type: 'user'
  name: 'Dan Rosart'

EVERYONE_PERM =
  # edit permissions for anyone with link
  withLink: true
  role: 'writer'
  type: 'anyone'
defaultPerms =  [GIVEN_OWNER_PERM, EVERYONE_PERM]
receivedPerms = [RECEIVED_OWNER_PERM, EVERYONE_PERM]

describe 'drive', ->
  clock = null
  api = null
  gapi = null

  beforeEach ->
    clock = sinon.useFakeTimers 7
    api =
      children: 'children'
      files: 'files'
      permissions: 'permissions'
    gapi = sinon.mock Gapi

  afterEach ->
    sinon.verifyAndRestore()

  it 'propagates errors', ->
    sinon.replace share, 'DO_BATCH_PROCESSING', false
    gapi.expects('exec').once().throws code: 400
    chai.assert.throws ->
      new Drive api

  it 'creates folder when batch is enabled', ->
    sinon.replace share, 'DO_BATCH_PROCESSING', true
    gapi.expects('exec').withArgs api.children, 'list', sinon.match
      folderId: 'root'
      q: 'title=\'MIT Mystery Hunt 2014\''
      maxResults: 1
    .returns items: []
    gapi.expects('exec').withArgs api.files, 'insert', sinon.match
      resource:
        title: 'MIT Mystery Hunt 2014'
        mimeType: 'application/vnd.google-apps.folder'
    .returns
      id: 'hunt'
      title: 'MIT Mystery Hunt 2014'
      mimeType: 'application/vnd.google-apps.folder'
    gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
      fileId: 'hunt'
    .returns items: []
    defaultPerms.forEach (perm) ->
      gapi.expects('exec').withArgs api.permissions, 'insert', sinon.match
        fileId: 'hunt'
        resource: perm
    gapi.expects('exec').withArgs api.children, 'list', sinon.match
      folderId: 'hunt'
      q: 'title=\'Ringhunters Uploads\''
      maxResults: 1
    .returns items: []
    gapi.expects('exec').withArgs api.files, 'insert', sinon.match
      resource:
        title: 'Ringhunters Uploads'
        mimeType: 'application/vnd.google-apps.folder'
    .returns
      id: 'uploads'
      title: 'Ringhunters Uploads'
      mimeType: 'application/vnd.google-apps.folder'
    gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
      fileId: 'uploads'
    .returns items: []
    defaultPerms.forEach (perm) ->
      gapi.expects('exec').withArgs api.permissions, 'insert', sinon.match
        fileId: 'uploads'
        resource: perm
    new Drive api

  describe 'with batch disabled', ->
    drive = null
    beforeEach ->
      sinon.replace share, 'DO_BATCH_PROCESSING', false
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'root'
        q: 'title=\'MIT Mystery Hunt 2014\''
        maxResults: 1
      .returns items: [
        id: 'hunt'
        title: 'MIT Mystery Hunt 2014'
        mimeType: 'application/vnd.google-apps.folder'
      ]
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'hunt'
        q: 'title=\'Ringhunters Uploads\''
        maxResults: 1
      .returns items: [
        id: 'uploads'
        title: 'Ringhunters Uploads'
        mimeType: 'application/vnd.google-apps.folder'
        parents: [id: 'hunt']
      ]
      drive = new Drive api

    it 'retries on throttle', ->
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'hunt'
        q: 'title=\'New Puzzle\''
        maxResults: 1
      .exactly(8).callsFake ->
        process.nextTick -> clock.next()
        throw
          code: 403
          errors: [
            domain: 'usageLimits'
            reason: 'userRateLimitExceeded'
          ]
      chai.assert.throws ->
        drive.createPuzzle 'New Puzzle'

    describe 'createPuzzle', ->
      it 'creates', ->
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'hunt'
          q: 'title=\'New Puzzle\''
          maxResults: 1
        .returns items: []
        gapi.expects('exec').withArgs api.files, 'insert', sinon.match
          resource:
            title: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: sinon.match.some sinon.match id: 'hunt'
        .returns
          id: 'newpuzzle'
          title: 'New Puzzle'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newpuzzle'
        .returns items: []
        defaultPerms.forEach (perm) ->
          gapi.expects('exec').withArgs api.permissions, 'insert', sinon.match
            fileId: 'newpuzzle'
            resource: perm
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet'"
        .returns items: []
        sheet = sinon.match
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          parents: sinon.match.some sinon.match id: 'newpuzzle'
        gapi.expects('exec').withArgs api.files, 'insert', sinon.match
          body: sheet
          resource: sheet
          convert: true
          media: sinon.match
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            body: sinon.match.instanceOf Uint8Array
        .returns
          id: 'newsheet'
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.google-apps.spreadsheet'
          parents: [id: 'newpuzzle']
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newsheet'
        .returns items: []
        defaultPerms.forEach (perm) ->
          gapi.expects('exec').withArgs api.permissions, 'insert', sinon.match
            fileId: 'newsheet'
            resource: perm
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document'"
        .returns items: []
        doc = sinon.match
          title: 'Notes: New Puzzle'
          mimeType: 'text/plain'
          parents: sinon.match.some sinon.match id: 'newpuzzle'
        gapi.expects('exec').withArgs api.files, 'insert', sinon.match
          body: doc
          resource: doc
          convert: true
          media: sinon.match
            mimeType: 'text/plain'
            body: 'Put notes here.'
        .returns
          id: 'newdoc'
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.google-apps.document'
          parents: [id: 'newpuzzle']
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newdoc'
        .returns items: []
        defaultPerms.forEach (perm) ->
          gapi.expects('exec').withArgs api.permissions, 'insert', sinon.match
            fileId: 'newdoc'
            resource: perm
        drive.createPuzzle 'New Puzzle'

      it 'returns existing', ->
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'hunt'
          q: 'title=\'New Puzzle\''
          maxResults: 1
        .returns items: [
          id: 'newpuzzle'
          title: 'New Puzzle'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        ]
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newpuzzle'
        .returns items: receivedPerms
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet'"
        .returns items: [
          id: 'newsheet'
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.google-apps.spreadsheet'
          parents: [id: 'newpuzzle']
        ]
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newsheet'
        .returns items: receivedPerms
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document'"
        .returns items: [
          id: 'newdoc'
          title: 'Notes: New Puzzle'
          mimeType: 'application/vnd.google-apps.document'
          parents: [id: 'newpuzzle']
        ]
        gapi.expects('exec').withArgs api.permissions, 'list', sinon.match
          fileId: 'newdoc'
        .returns items: receivedPerms
        drive.createPuzzle 'New Puzzle'

    describe 'findPuzzle', ->
      it 'returns null when no puzzle', ->
        gapi.expects('exec').withArgs api.children, 'list', sinon.match 
          folderId: 'hunt'
          q: 'title=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\''
          maxResults: 1
          # pageToken: undefined
        .returns items: []
        chai.assert.isNull drive.findPuzzle 'New Puzzle'
      
      it 'returns spreadsheet and doc', ->
        gapi.expects('exec').withArgs api.children, 'list', sinon.match 
          folderId: 'hunt'
          q: 'title=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\''
          maxResults: 1
          # pageToken: undefined
        .returns items: [
          id: 'newpuzzle'
          title: 'New Puzzle'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        ]
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Worksheet: New Puzzle'"
        .returns items: [
          id: 'newsheet'
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.google-apps.spreadsheet'
          parents: [id: 'newpuzzle']
        ]
        gapi.expects('exec').withArgs api.children, 'list', sinon.match
          folderId: 'newpuzzle'
          maxResults: 1
          q: "title='Notes: New Puzzle'"
        .returns items: [
          id: 'newdoc'
          title: 'Notes: New Puzzle'
          mimeType: 'application/vnd.google-apps.document'
          parents: [id: 'newpuzzle']
        ]
        chai.assert.include drive.findPuzzle('New Puzzle'),
          id: 'newpuzzle'
          spreadId: 'newsheet'
          docId: 'newdoc'

    it 'listPuzzles returns list', ->
      item1 =
        id: 'newpuzzle'
        title: 'New Puzzle'
        mimeType: 'application/vnd.google-apps.folder'
        parents: [id: 'hunt']
      item2 =
        id: 'oldpuzzle'
        title: 'Old Puzzle'
        mimeType: 'application/vnd.google-apps.folder'
        parents: [id: 'hunt']
      gapi.expects('exec').withArgs api.children, 'list', sinon.match 
        folderId: 'hunt'
        q: 'mimeType=\'application/vnd.google-apps.folder\''
        maxResults: 200
        # pageToken: undefined
      .returns
        items: [item1]
        nextPageToken: 'token'
      gapi.expects('exec').withArgs api.children, 'list', sinon.match 
        folderId: 'hunt'
        q: 'mimeType=\'application/vnd.google-apps.folder\''
        maxResults: 200
        pageToken: 'token'
      .returns
        items: [item2]
      chai.assert.sameDeepOrderedMembers drive.listPuzzles(), [item1, item2]

    it 'renamePuzzle renames', ->
      gapi.expects('exec').withArgs api.files, 'patch', sinon.match
        fileId: 'newpuzzle'
        resource: sinon.match title: 'Old Puzzle'
      gapi.expects('exec').withArgs api.files, 'patch', sinon.match
        fileId: 'newsheet'
        resource: sinon.match title: 'Worksheet: Old Puzzle'
      gapi.expects('exec').withArgs api.files, 'patch', sinon.match
        fileId: 'newdoc'
        resource: sinon.match title: 'Notes: Old Puzzle'
      drive.renamePuzzle 'Old Puzzle', 'newpuzzle', 'newsheet', 'newdoc'

    it 'deletePuzzle deletes', ->
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'newpuzzle'
        q: 'mimeType=\'application/vnd.google-apps.folder\''
        maxResults: 200
      .returns items: []  # Puzzles don't have folders
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'newpuzzle'
        q: 'mimeType!=\'application/vnd.google-apps.folder\''
        maxResults: 200
      .returns
        items: [
          id: 'newsheet'
          title: 'Worksheet: New Puzzle'
          mimeType: 'application/vnd.google-apps.spreadsheet'
          parents: [id: 'newpuzzle']
        ]
        nextPageToken: 'token'
      gapi.expects('exec').withArgs api.files, 'delete', sinon.match
        fileId: 'newsheet'
      gapi.expects('exec').withArgs api.children, 'list', sinon.match
        folderId: 'newpuzzle'
        q: 'mimeType!=\'application/vnd.google-apps.folder\''
        maxResults: 200
        pageToken: 'token'
      .returns
        items: [
          id: 'newdoc'
          title: 'Notes: New Puzzle'
          mimeType: 'application/vnd.google-apps.document'
          parents: [id: 'newpuzzle']
        ]
      gapi.expects('exec').withArgs api.files, 'delete', sinon.match
        fileId: 'newdoc'
      gapi.expects('exec').withArgs api.files, 'delete', sinon.match
        fileId: 'newpuzzle'
      drive.deletePuzzle 'newpuzzle'

