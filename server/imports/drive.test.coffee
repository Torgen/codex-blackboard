'use strict'

import '../000batch.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { Drive } from './drive.coffee'
import { Readable } from 'stream'

GIVEN_OWNER_PERM =
  withLink: false
  role: 'writer'
  type: 'user'
  value: 'foo@bar.baz'

RECEIVED_OWNER_PERM = 
  withLink: false
  role: 'writer'
  type: 'user'
  emailAddress: 'foo@bar.baz'

EVERYONE_PERM =
  # edit permissions for anyone with link
  withLink: true
  role: 'writer'
  type: 'anyone'
defaultPerms =  [EVERYONE_PERM, GIVEN_OWNER_PERM]
receivedPerms = [RECEIVED_OWNER_PERM, EVERYONE_PERM]

describe 'drive', ->
  clock = null
  api = null
  children = null
  files = null
  permissions = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date', 'setTimeout', 'clearTimeout']
    api =
      children:
        list: ->
      files:
        insert: ->
        delete: ->
        patch: ->
      permissions:
        list: ->
        insert: ->
    children = sinon.mock(api.children)
    files = sinon.mock(api.files)
    permissions = sinon.mock(api.permissions)
    Meteor.settings.folder = 'Test Folder'

  afterEach ->
    clock.restore()
    sinon.verifyAndRestore()

  it 'propagates errors', ->
    sinon.replace share, 'DO_BATCH_PROCESSING', false
    children.expects('list').once().rejects code: 400
    chai.assert.throws ->
      new Drive api

  testCase = (perms) ->
    it 'creates folder when batch is enabled', ->
      sinon.replace share, 'DO_BATCH_PROCESSING', true
      children.expects('list').withArgs sinon.match
        folderId: 'root'
        q: 'title=\'Test Folder\''
        maxResults: 1
      .resolves data: items: []
      files.expects('insert').withArgs sinon.match
        resource:
          title: 'Test Folder'
          mimeType: 'application/vnd.google-apps.folder'
      .resolves data:
        id: 'hunt'
        title: 'Test Folder'
        mimeType: 'application/vnd.google-apps.folder'
      permissions.expects('list').withArgs sinon.match
        fileId: 'hunt'
      .resolves data: items: []
      perms.forEach (perm) ->
        permissions.expects('insert').withArgs sinon.match
          fileId: 'hunt'
          resource: perm
        .resolves data: {}
      children.expects('list').withArgs sinon.match
        folderId: 'hunt'
        q: 'title=\'Ringhunters Uploads\''
        maxResults: 1
      .resolves data: items: []
      files.expects('insert').withArgs sinon.match
        resource:
          title: 'Ringhunters Uploads'
          mimeType: 'application/vnd.google-apps.folder'
      .resolves data:
        id: 'uploads'
        title: 'Ringhunters Uploads'
        mimeType: 'application/vnd.google-apps.folder'
      permissions.expects('list').withArgs sinon.match
        fileId: 'uploads'
      .resolves data: items: []
      perms.forEach (perm) ->
        permissions.expects('insert').withArgs sinon.match
          fileId: 'uploads'
          resource: perm
        .resolves data:{}
      new Drive api

    describe 'with batch disabled', ->
      drive = null
      beforeEach ->
        sinon.replace share, 'DO_BATCH_PROCESSING', false
        children.expects('list').withArgs sinon.match
          folderId: 'root'
          q: 'title=\'Test Folder\''
          maxResults: 1
        .resolves data: items: [
          id: 'hunt'
          title: 'Test Folder'
          mimeType: 'application/vnd.google-apps.folder'
        ]
        children.expects('list').withArgs sinon.match
          folderId: 'hunt'
          q: 'title=\'Ringhunters Uploads\''
          maxResults: 1
        .resolves data: items: [
          id: 'uploads'
          title: 'Ringhunters Uploads'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        ]
        drive = new Drive api

      describe 'createPuzzle', ->
        it 'creates', ->
          children.expects('list').withArgs sinon.match
            folderId: 'hunt'
            q: 'title=\'New Puzzle\''
            maxResults: 1
          .resolves data: items: []
          files.expects('insert').withArgs sinon.match
            resource:
              title: 'New Puzzle'
              mimeType: 'application/vnd.google-apps.folder'
              parents: sinon.match.some sinon.match id: 'hunt'
          .resolves data:
            id: 'newpuzzle'
            title: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newpuzzle'
          .resolves data: items: []
          perms.forEach (perm) ->
            permissions.expects('insert').withArgs sinon.match
              fileId: 'newpuzzle'
              resource: perm
            .resolves data: {}
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet'"
          .resolves data: items: []
          sheet = sinon.match
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            parents: sinon.match.some sinon.match id: 'newpuzzle'
          files.expects('insert').withArgs sinon.match
            body: sheet
            resource: sheet
            convert: true
            media: sinon.match
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              body: sinon.match.instanceOf Readable
          .resolves data:
            id: 'newsheet'
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newsheet'
          .resolves data: items: []
          perms.forEach (perm) ->
            permissions.expects('insert').withArgs sinon.match
              fileId: 'newsheet'
              resource: perm
            .resolves data: {}
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document'"
          .resolves data: items: []
          doc = sinon.match
            title: 'Notes: New Puzzle'
            mimeType: 'text/plain'
            parents: sinon.match.some sinon.match id: 'newpuzzle'
          files.expects('insert').withArgs sinon.match
            body: doc
            resource: doc
            convert: true
            media: sinon.match
              mimeType: 'text/plain'
              body: 'Put notes here.'
          .resolves data:
            id: 'newdoc'
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: [id: 'newpuzzle']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newdoc'
          .resolves data: items: []
          perms.forEach (perm) ->
            permissions.expects('insert').withArgs sinon.match
              fileId: 'newdoc'
              resource: perm
            .resolves data: {}
          drive.createPuzzle 'New Puzzle'

        it 'returns existing', ->
          children.expects('list').withArgs sinon.match
            folderId: 'hunt'
            q: 'title=\'New Puzzle\''
            maxResults: 1
          .resolves data: items: [
            id: 'newpuzzle'
            title: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newpuzzle'
          .resolves data: items: receivedPerms
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet'"
          .resolves data: items: [
            id: 'newsheet'
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newsheet'
          .resolves data: items: receivedPerms
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document'"
          .resolves data: items: [
            id: 'newdoc'
            title: 'Notes: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: [id: 'newpuzzle']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newdoc'
          .resolves data: items: receivedPerms
          drive.createPuzzle 'New Puzzle'

      describe 'findPuzzle', ->
        it 'returns null when no puzzle', ->
          children.expects('list').withArgs sinon.match 
            folderId: 'hunt'
            q: 'title=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\''
            maxResults: 1
            # pageToken: undefined
          .resolves data: items: []
          chai.assert.isNull drive.findPuzzle 'New Puzzle'
        
        it 'returns spreadsheet and doc', ->
          children.expects('list').withArgs sinon.match 
            folderId: 'hunt'
            q: 'title=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\''
            maxResults: 1
            # pageToken: undefined
          .resolves data: items: [
            id: 'newpuzzle'
            title: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          ]
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Worksheet: New Puzzle'"
          .resolves data: items: [
            id: 'newsheet'
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          children.expects('list').withArgs sinon.match
            folderId: 'newpuzzle'
            maxResults: 1
            q: "title='Notes: New Puzzle'"
          .resolves data: items: [
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
        children.expects('list').withArgs sinon.match 
          folderId: 'hunt'
          q: 'mimeType=\'application/vnd.google-apps.folder\''
          maxResults: 200
          # pageToken: undefined
        .resolves data:
          items: [item1]
          nextPageToken: 'token'
        children.expects('list').withArgs sinon.match 
          folderId: 'hunt'
          q: 'mimeType=\'application/vnd.google-apps.folder\''
          maxResults: 200
          pageToken: 'token'
        .resolves data:
          items: [item2]
        chai.assert.sameDeepOrderedMembers drive.listPuzzles(), [item1, item2]

      it 'renamePuzzle renames', ->
        files.expects('patch').withArgs sinon.match
          fileId: 'newpuzzle'
          resource: sinon.match title: 'Old Puzzle'
        .resolves data: {}
        files.expects('patch').withArgs sinon.match
          fileId: 'newsheet'
          resource: sinon.match title: 'Worksheet: Old Puzzle'
        .resolves data: {}
        files.expects('patch').withArgs sinon.match
          fileId: 'newdoc'
          resource: sinon.match title: 'Notes: Old Puzzle'
        .resolves data: {}
        drive.renamePuzzle 'Old Puzzle', 'newpuzzle', 'newsheet', 'newdoc'

      it 'deletePuzzle deletes', ->
        children.expects('list').withArgs sinon.match
          folderId: 'newpuzzle'
          q: 'mimeType=\'application/vnd.google-apps.folder\''
          maxResults: 200
        .resolves data: items: []  # Puzzles don't have folders
        children.expects('list').withArgs sinon.match
          folderId: 'newpuzzle'
          q: 'mimeType!=\'application/vnd.google-apps.folder\''
          maxResults: 200
        .resolves data:
          items: [
            id: 'newsheet'
            title: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          nextPageToken: 'token'
        files.expects('delete').withArgs sinon.match
          fileId: 'newsheet'
        .resolves data: {}
        children.expects('list').withArgs sinon.match
          folderId: 'newpuzzle'
          q: 'mimeType!=\'application/vnd.google-apps.folder\''
          maxResults: 200
          pageToken: 'token'
        .resolves data:
          items: [
            id: 'newdoc'
            title: 'Notes: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: [id: 'newpuzzle']
          ]
        files.expects('delete').withArgs sinon.match
          fileId: 'newdoc'
        .resolves data: {}
        files.expects('delete').withArgs sinon.match
          fileId: 'newpuzzle'
        .resolves data: {}
        drive.deletePuzzle 'newpuzzle'
  describe 'with drive owner set', ->
    beforeEach ->
      Meteor.settings.driveowner = 'foo@bar.baz'

    testCase defaultPerms

  describe 'with no drive owner set', ->
    beforeEach ->
      Meteor.settings.driveowner = undefined
    
    testCase [EVERYONE_PERM]
