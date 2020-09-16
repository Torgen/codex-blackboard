'use strict'

import { Readable } from 'stream'
import delay from 'delay'

# Drive folder settings
DEFAULT_ROOT_FOLDER_NAME = "MIT Mystery Hunt #{new Date().getFullYear()}"
ROOT_FOLDER_NAME = -> Meteor.settings.folder or process.env.DRIVE_ROOT_FOLDER or DEFAULT_ROOT_FOLDER_NAME
CODEX_ACCOUNT = -> Meteor.settings.driveowner or process.env.DRIVE_OWNER_ADDRESS
WORKSHEET_NAME = (name) -> "Worksheet: #{name}"
DOC_NAME = (name) -> "Notes: #{name}"

# Constants
GDRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
GDRIVE_SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet'
GDRIVE_DOC_MIME_TYPE = 'application/vnd.google-apps.document'
XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
MAX_RESULTS = 200
SPREADSHEET_TEMPLATE = Assets.getBinary 'spreadsheet-template.xlsx'

quote = (str) -> "'#{str.replace(/([\'\\])/g, '\\$1')}'"

samePerm = (p, pp) ->
  (p.allowFileDiscovery or true) is (pp.allowFileDiscovery or true) and \
  p.role is pp.role and \
  p.type is pp.type and \
  if p.type is 'anyone'
    true
  else
    (p.emailAddress is pp.emailAddress)

ensurePermissions = (drive, id) ->
  # give permissions to both anyone with link and to the primary
  # service acount.  the service account must remain the owner in
  # order to be able to rename the folder
  perms = [
    # edit permissions for anyone with link
    allowFileDiscovery: false
    role: 'writer'
    type: 'anyone'
  ]
  if CODEX_ACCOUNT()?
    perms.push
      # edit permissions to codex account
      allowFileDiscovery: true
      role: 'writer'
      type: 'user'
      emailAddress: CODEX_ACCOUNT()
  resp = (await drive.permissions.list fileId: id).data
  ps = []
  perms.forEach (p) ->
    # does this permission already exist?
    exists = resp.permissions.some (pp) -> samePerm p, pp
    unless exists
      ps.push drive.permissions.create
        fileId: id
        resource: p
  await Promise.all ps
  'ok'

spreadsheetSettings =
  titleFunc: WORKSHEET_NAME
  driveMimeType: GDRIVE_SPREADSHEET_MIME_TYPE
  uploadMimeType: XLSX_MIME_TYPE
  uploadTemplate: ->
    # The file is small enough to fit in ram, so don't recreate a file read
    # stream every time.
    # Apparently there's a module called streamifier that does this.
    r = new Readable
    r._read = ->
    r.push SPREADSHEET_TEMPLATE
    r.push null
    r

docSettings =
  titleFunc: DOC_NAME
  driveMimeType: GDRIVE_DOC_MIME_TYPE
  uploadMimeType: 'text/plain'
  uploadTemplate: -> 'Put notes here.'
  
ensure = (drive, name, folder, settings) ->
  doc = (await drive.files.list
    q: "name=#{quote settings.titleFunc name} and mimeType=#{quote settings.driveMimeType} and #{quote folder.id} in parents"
    pageSize: 1
  ).data.files[0]
  unless doc?
    doc =
      name: settings.titleFunc name
      mimeType: settings.driveMimeType
      parents: [id: folder.id]
    doc = (await drive.files.create
      resource: doc
      media:
        mimeType: settings.uploadMimeType
        body: settings.uploadTemplate()
    ).data
  await ensurePermissions drive, doc.id
  doc

awaitFolder = (drive, name, parent) ->
  triesLeft = 5
  loop
    resp = (await drive.files.list
      q: "name=#{quote name} and #{quote parent} in parents"
      pageSize: 1
    ).data
    if resp.files.length > 0
      console.log "#{name} found"
      return resp.files[0]
    else if triesLeft < 1
      console.log "#{name} never existed"
      throw 'never existed'
    else
      console.log "Waiting #{attempts} more times for #{name}"
      await delay 1000
      triesLeft--

ensureFolder = (drive, name, parent) ->
  # check to see if the folder already exists
  resp = (await drive.files.list
    q: "name=#{quote name} and #{quote (parent or 'root')} in parents"
    pageSize: 1
  ).data
  if resp.files.length > 0
    resource = resp.files[0]
  else
    # create the folder
    resource =
      name: name
      mimeType: GDRIVE_FOLDER_MIME_TYPE
    resource.parents = [id: parent] if parent
    resource = (await drive.files.create(resource: resource)).data
  # give the new folder the right permissions
  {
    folder: resource
    permissionsPromise: ensurePermissions drive, resource.id
  }

awaitOrEnsureFolder = (drive, name, parent) ->
  if share.DO_BATCH_PROCESSING
    res = await ensureFolder drive, name, parent
    await res.permissionsPromise
    return res.folder
  try
    return await awaitFolder drive, name, (parent or 'root')
  catch error
    if error is "never existed"
      res = await ensureFolder drive, name, parent
      await res.permissionsPromise
      return res.folder
    throw error

rmrfFolder = (drive, id) ->
  resp = {}
  ps = []
  loop
    # delete subfolders
    resp = (await drive.files.list
      q: "mimeType=#{quote GDRIVE_FOLDER_MIME_TYPE} and #{quote id} in parents"
      pageSize: MAX_RESULTS
      pageToken: resp.nextPageToken
    ).data
    resp.files.forEach (item) ->
      ps.push rmrfFolder item.id
    break unless resp.nextPageToken?
  loop
    # delete non-folder stuff
    resp = (await drive.files.list
      q: "mimeType!=#{quote GDRIVE_FOLDER_MIME_TYPE} and #{quote id} in parents"
      pageSize: MAX_RESULTS
      pageToken: resp.nextPageToken
    ).data
    resp.files.forEach (item) ->
      ps.push drive.files.delete fileId: item.id
    break unless resp.nextPageToken?
  await Promise.all ps
  # folder empty; delete the folder and we're done
  await drive.files.delete fileId: id
  'ok'

export class Drive
  constructor: (@drive) ->
    @rootFolder = (Promise.await(awaitOrEnsureFolder @drive, ROOT_FOLDER_NAME())).id
    @ringhuntersFolder = (Promise.await(awaitOrEnsureFolder @drive, "#{Meteor.settings?.public?.chatName ? 'Ringhunters'} Uploads", @rootFolder)).id
  
  createPuzzle: (name) ->
    {folder, permissionsPromise} = Promise.await ensureFolder @drive, name, @rootFolder
    # is the spreadsheet already there?
    spreadsheetP = ensure @drive, name, folder, spreadsheetSettings
    docP = ensure @drive, name, folder, docSettings
    [spreadsheet, doc, p] = Promise.await Promise.all [spreadsheetP, docP, permissionsPromise]
    return {
      id: folder.id
      spreadId: spreadsheet.id
      docId: doc.id
    }

  findPuzzle: (name) ->
    resp = (Promise.await @drive.files.list
      q: "name=#{quote name} and mimeType=#{quote GDRIVE_FOLDER_MIME_TYPE} and #{quote @rootFolder} in parents"
      pageSize: 1
    ).data
    folder = resp.files[0]
    return null unless folder?
    # look for spreadsheet
    spreadP = @drive.files.list
      q: "name=#{quote WORKSHEET_NAME name} and #{quote folder.id} in parents"
      pageSize: 1
    docP = @drive.files.list
      q: "name=#{quote DOC_NAME name} and #{quote folder.id} in parents"
      pageSize: 1
    [spread, doc] = Promise.await Promise.all [spreadP, docP]
    return {
      id: folder.id
      spreadId: spread.data.files[0]?.id
      docId: doc.data.files[0]?.id
    }

  listPuzzles: ->
    resp = {}
    results = []
    loop
      resp = (Promise.await @drive.files.list
        q: "mimeType=#{quote GDRIVE_FOLDER_MIME_TYPE} and #{quote @rootFolder} in parents"
        pageSize: MAX_RESULTS
        pageToken: resp.nextPageToken
      ).data
      results.push resp.files...
      break unless resp.nextPageToken?
    results

  renamePuzzle: (name, id, spreadId, docId) ->
    ps = [@drive.files.update
      fileId: id
      resource:
        name: name
    ]
    if spreadId?
      ps.push(@drive.files.update
        fileId: spreadId
        resource:
          name: WORKSHEET_NAME name
      )
    if docId?
      ps.push(@drive.files.update
        fileId: docId
        resource:
          name: DOC_NAME name
      )
    Promise.await Promise.all ps
    'ok'

  deletePuzzle: (id) -> Promise.await rmrfFolder @drive, id

  # purge `rootFolder` and everything in it
  purge: -> Promise.await rmrfFolder @drive, rootFolder

# generate functions
skip = (type) -> -> console.warn "Skipping Google Drive operation:", type

export class FailDrive
  createPuzzle: skip 'createPuzzle'
  findPuzzle: skip 'findPuzzle'
  listPuzzles: skip 'listPuzzles'
  renamePuzzle: skip 'renamePuzzle'
  deletePuzzle: skip 'deletePuzzle'
  purge: skip 'purge'