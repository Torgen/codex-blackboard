'use strict'

import '../000batch.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { Drive } from './drive.coffee'
import { Readable } from 'stream'

OWNER_PERM =
  allowFileDiscovery: true
  role: 'writer'
  type: 'user'
  emailAddress: 'foo@bar.baz'

EVERYONE_PERM =
  # edit permissions for anyone with link
  allowFileDiscovery: false
  role: 'writer'
  type: 'anyone'

defaultPerms =  [EVERYONE_PERM, OWNER_PERM]

describe 'drive', ->
  clock = null
  api = null
  files = null
  permissions = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date', 'setTimeout', 'clearTimeout']
    api =
      files:
        create: ->
        delete: ->
        list: ->
        update: ->
      permissions:
        list: ->
        create: ->
    files = sinon.mock(api.files)
    permissions = sinon.mock(api.permissions)
    Meteor.settings.folder = 'Test Folder'

  afterEach ->
    clock.restore()
    sinon.verifyAndRestore()

  it 'propagates errors', ->
    sinon.replace share, 'DO_BATCH_PROCESSING', false
    files.expects('list').once().rejects code: 400
    chai.assert.throws ->
      new Drive api

  testCase = (perms) ->
    it 'creates folder when batch is enabled', ->
      sinon.replace share, 'DO_BATCH_PROCESSING', true
      files.expects('list').withArgs sinon.match
        q: 'name=\'Test Folder\' and \'root\' in parents'
        pageSize: 1
      .resolves data: files: []
      files.expects('create').withArgs sinon.match
        resource:
          name: 'Test Folder'
          mimeType: 'application/vnd.google-apps.folder'
      .resolves data:
        id: 'hunt'
        name: 'Test Folder'
        mimeType: 'application/vnd.google-apps.folder'
      permissions.expects('list').withArgs sinon.match
        fileId: 'hunt'
      .resolves data: permissions: []
      perms.forEach (perm) ->
        permissions.expects('create').withArgs sinon.match
          fileId: 'hunt'
          resource: perm
        .resolves data: {}
      files.expects('list').withArgs sinon.match
        q: 'name=\'Ringhunters Uploads\' and \'hunt\' in parents'
        pageSize: 1
      .resolves data: files: []
      files.expects('create').withArgs sinon.match
        resource:
          name: 'Ringhunters Uploads'
          mimeType: 'application/vnd.google-apps.folder'
          parents: sinon.match.some sinon.match id: 'hunt'
      .resolves data:
        id: 'uploads'
        name: 'Ringhunters Uploads'
        mimeType: 'application/vnd.google-apps.folder'
      permissions.expects('list').withArgs sinon.match
        fileId: 'uploads'
      .resolves data: permissions: []
      perms.forEach (perm) ->
        permissions.expects('create').withArgs sinon.match
          fileId: 'uploads'
          resource: perm
        .resolves data:{}
      new Drive api

    describe 'with batch disabled', ->
      drive = null
      beforeEach ->
        sinon.replace share, 'DO_BATCH_PROCESSING', false
        files.expects('list').withArgs sinon.match
          q: 'name=\'Test Folder\' and \'root\' in parents'
          pageSize: 1
        .resolves data: files: [
          id: 'hunt'
          name: 'Test Folder'
          mimeType: 'application/vnd.google-apps.folder'
        ]
        files.expects('list').withArgs sinon.match
          q: 'name=\'Ringhunters Uploads\' and \'hunt\' in parents'
          pageSize: 1
        .resolves data: files: [
          id: 'uploads'
          name: 'Ringhunters Uploads'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        ]
        drive = new Drive api

      describe 'createPuzzle', ->
        it 'creates', ->
          files.expects('list').withArgs sinon.match
            q: 'name=\'New Puzzle\' and \'hunt\' in parents'
            pageSize: 1
          .resolves data: files: []
          files.expects('create').withArgs sinon.match
            resource:
              name: 'New Puzzle'
              mimeType: 'application/vnd.google-apps.folder'
              parents: sinon.match.some sinon.match id: 'hunt'
          .resolves data:
            id: 'newpuzzle'
            name: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newpuzzle'
          .resolves data: permissions: []
          perms.forEach (perm) ->
            permissions.expects('create').withArgs sinon.match
              fileId: 'newpuzzle'
              resource: perm
            .resolves data: {}
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet' and \'newpuzzle\' in parents"
          .resolves data: files: []
          sheet = sinon.match
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: sinon.match.some sinon.match id: 'newpuzzle'
          files.expects('create').withArgs sinon.match
            resource: sheet
            media: sinon.match
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              body: sinon.match.instanceOf Readable
          .resolves data:
            id: 'newsheet'
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newsheet'
          .resolves data: permissions: []
          perms.forEach (perm) ->
            permissions.expects('create').withArgs sinon.match
              fileId: 'newsheet'
              resource: perm
            .resolves data: {}
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document' and \'newpuzzle\' in parents"
          .resolves data: files: []
          doc = sinon.match
            name: 'Notes: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: sinon.match.some sinon.match id: 'newpuzzle'
          files.expects('create').withArgs sinon.match
            resource: doc
            media: sinon.match
              mimeType: 'text/plain'
              body: 'Put notes here.'
          .resolves data:
            id: 'newdoc'
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: [id: 'newpuzzle']
          permissions.expects('list').withArgs sinon.match
            fileId: 'newdoc'
          .resolves data: permissions: []
          perms.forEach (perm) ->
            permissions.expects('create').withArgs sinon.match
              fileId: 'newdoc'
              resource: perm
            .resolves data: {}
          drive.createPuzzle 'New Puzzle'

        it 'returns existing', ->
          files.expects('list').withArgs sinon.match
            q: 'name=\'New Puzzle\' and \'hunt\' in parents'
            pageSize: 1
          .resolves data: files: [
            id: 'newpuzzle'
            name: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newpuzzle'
          .resolves data: permissions: defaultPerms
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet' and 'newpuzzle' in parents"
          .resolves data: files: [
            id: 'newsheet'
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newsheet'
          .resolves data: permissions: defaultPerms
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Notes: New Puzzle' and mimeType='application/vnd.google-apps.document' and 'newpuzzle' in parents"
          .resolves data: files: [
            id: 'newdoc'
            name: 'Notes: New Puzzle'
            mimeType: 'application/vnd.google-apps.document'
            parents: [id: 'newpuzzle']
          ]
          permissions.expects('list').withArgs sinon.match
            fileId: 'newdoc'
          .resolves data: permissions: defaultPerms
          drive.createPuzzle 'New Puzzle'

      describe 'findPuzzle', ->
        it 'returns null when no puzzle', ->
          files.expects('list').withArgs sinon.match 
            q: 'name=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\' and \'hunt\' in parents'
            pageSize: 1
            # pageToken: undefined
          .resolves data: files: []
          chai.assert.isNull drive.findPuzzle 'New Puzzle'
        
        it 'returns spreadsheet and doc', ->
          files.expects('list').withArgs sinon.match 
            q: 'name=\'New Puzzle\' and mimeType=\'application/vnd.google-apps.folder\' and \'hunt\' in parents'
            pageSize: 1
            # pageToken: undefined
          .resolves data: files: [
            id: 'newpuzzle'
            name: 'New Puzzle'
            mimeType: 'application/vnd.google-apps.folder'
            parents: [id: 'hunt']
          ]
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Worksheet: New Puzzle' and \'newpuzzle\' in parents"
          .resolves data: files: [
            id: 'newsheet'
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          files.expects('list').withArgs sinon.match
            pageSize: 1
            q: "name='Notes: New Puzzle' and 'newpuzzle' in parents"
          .resolves data: files: [
            id: 'newdoc'
            name: 'Notes: New Puzzle'
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
          name: 'New Puzzle'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        item2 =
          id: 'oldpuzzle'
          name: 'Old Puzzle'
          mimeType: 'application/vnd.google-apps.folder'
          parents: [id: 'hunt']
        files.expects('list').withArgs sinon.match 
          q: 'mimeType=\'application/vnd.google-apps.folder\' and \'hunt\' in parents'
          pageSize: 200
          # pageToken: undefined
        .resolves data:
          files: [item1]
          nextPageToken: 'token'
        files.expects('list').withArgs sinon.match 
          q: 'mimeType=\'application/vnd.google-apps.folder\' and \'hunt\' in parents'
          pageSize: 200
          pageToken: 'token'
        .resolves data:
          files: [item2]
        chai.assert.sameDeepOrderedMembers drive.listPuzzles(), [item1, item2]

      it 'renamePuzzle renames', ->
        files.expects('update').withArgs sinon.match
          fileId: 'newpuzzle'
          resource: sinon.match name: 'Old Puzzle'
        .resolves data: {}
        files.expects('update').withArgs sinon.match
          fileId: 'newsheet'
          resource: sinon.match name: 'Worksheet: Old Puzzle'
        .resolves data: {}
        files.expects('update').withArgs sinon.match
          fileId: 'newdoc'
          resource: sinon.match name: 'Notes: Old Puzzle'
        .resolves data: {}
        drive.renamePuzzle 'Old Puzzle', 'newpuzzle', 'newsheet', 'newdoc'

      it 'deletePuzzle deletes', ->
        files.expects('list').withArgs sinon.match
          q: 'mimeType=\'application/vnd.google-apps.folder\' and \'newpuzzle\' in parents'
          pageSize: 200
        .resolves data: files: []  # Puzzles don't have folders
        files.expects('list').withArgs sinon.match
          q: 'mimeType!=\'application/vnd.google-apps.folder\' and \'newpuzzle\' in parents'
          pageSize: 200
        .resolves data:
          files: [
            id: 'newsheet'
            name: 'Worksheet: New Puzzle'
            mimeType: 'application/vnd.google-apps.spreadsheet'
            parents: [id: 'newpuzzle']
          ]
          nextPageToken: 'token'
        files.expects('delete').withArgs sinon.match
          fileId: 'newsheet'
        .resolves data: {}
        files.expects('list').withArgs sinon.match
          q: 'mimeType!=\'application/vnd.google-apps.folder\' and \'newpuzzle\' in parents'
          pageSize: 200
          pageToken: 'token'
        .resolves data:
          files: [
            id: 'newdoc'
            name: 'Notes: New Puzzle'
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
