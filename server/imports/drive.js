import { Readable } from "stream";
import delay from "delay";
import {
  ROOT_FOLDER_NAME,
  CODEX_ACCOUNT,
  SHARE_GROUP,
} from "./googlecommon.js";
import * as batch from "/server/imports/batch.js";

// Drive folder settings
const WORKSHEET_NAME = (name) => `Worksheet: ${name}`;

// Constants
const GDRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GDRIVE_SPREADSHEET_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_RESULTS = 200;
const SPREADSHEET_TEMPLATE = Assets.getBinaryAsync(
  "spreadsheet-template.xlsx"
);

const PERMISSION_LIST_FIELDS =
  "permissions(role,type,emailAddress,allowFileDiscovery)";

const quote = (str) => `'${str.replace(/([\'\\])/g, "\\$1")}'`;

const samePerm = (p, pp) =>
  (p.allowFileDiscovery || true) === (pp.allowFileDiscovery || true) &&
  p.role === pp.role &&
  p.type === pp.type &&
  (p.type === "anyone" ? true : p.emailAddress === pp.emailAddress);

async function ensurePermissions(drive, id) {
  // give permissions to both anyone with link and to the primary
  // service acount.  the service account must remain the owner in
  // order to be able to rename the folder
  const perms = [
    {
      resource: {
        // edit permissions for anyone with link
        allowFileDiscovery: false,
        role: "writer",
        type: "anyone",
      },
    },
  ];
  if (CODEX_ACCOUNT() != null) {
    perms.push({
      sendNotificationEmail: false,
      resource: {
        // edit permissions to codex account
        role: "writer",
        type: "user",
        emailAddress: CODEX_ACCOUNT(),
      },
    });
  }
  if (SHARE_GROUP() != null) {
    perms.push({
      sendNotificationEmail: false,
      resource: {
        // edit permission to a google group
        role: "writer",
        type: "group",
        emailAddress: SHARE_GROUP(),
      },
    });
  }
  const resp = (
    await drive.permissions.list({ fileId: id, fields: PERMISSION_LIST_FIELDS })
  ).data;
  const ps = [];
  perms.forEach(function (p) {
    // does this permission already exist?
    const exists = resp.permissions.some((pp) => samePerm(p.resource, pp));
    if (!exists) {
      ps.push(drive.permissions.create({ fileId: id, ...p }));
    }
  });
  await Promise.all(ps);
  return "ok";
}

const spreadsheetSettings = {
  titleFunc: WORKSHEET_NAME,
  driveMimeType: GDRIVE_SPREADSHEET_MIME_TYPE,
  uploadMimeType: XLSX_MIME_TYPE,
  async uploadTemplate() {
    // The file is small enough to fit in ram, so don't recreate a file read
    // stream every time.
    // Apparently there's a module called streamifier that does this.
    const r = new Readable();
    r._read = function () {};
    r.push(await SPREADSHEET_TEMPLATE);
    r.push(null);
    return r;
  },
};

async function ensure(drive, name, folder, settings) {
  let doc = (
    await drive.files.list({
      q: `name=${quote(settings.titleFunc(name))} and mimeType=${quote(
        settings.driveMimeType
      )} and ${quote(folder.id)} in parents`,
      pageSize: 1,
    })
  ).data.files[0];
  if (doc == null) {
    doc = {
      name: settings.titleFunc(name),
      mimeType: settings.driveMimeType,
      parents: [folder.id],
    };
    doc = (
      await drive.files.create({
        resource: doc,
        media: {
          mimeType: settings.uploadMimeType,
          body: await settings.uploadTemplate(),
        },
      })
    ).data;
  }
  await ensurePermissions(drive, doc.id);
  return doc;
}

async function awaitFolder(drive, name, parent) {
  let triesLeft = 5;
  while (true) {
    const resp = (
      await drive.files.list({
        q: `name=${quote(name)} and ${quote(parent)} in parents`,
        pageSize: 1,
      })
    ).data;
    if (resp.files.length > 0) {
      console.log(`${name} found`);
      return resp.files[0];
    } else if (triesLeft < 1) {
      console.log(`${name} never existed`);
      throw new Error("never existed");
    } else {
      console.log(`Waiting ${triesLeft} more times for ${name}`);
      await delay(1000);
      triesLeft--;
    }
  }
}

async function ensureFolder(drive, name, parent) {
  // check to see if the folder already exists
  let resource;
  const resp = (
    await drive.files.list({
      q: `name=${quote(name)} and ${quote(parent || "root")} in parents`,
      pageSize: 1,
    })
  ).data;
  if (resp.files.length > 0) {
    resource = resp.files[0];
  } else {
    // create the folder
    resource = {
      name,
      mimeType: GDRIVE_FOLDER_MIME_TYPE,
    };
    if (parent) {
      resource.parents = [parent];
    }
    resource = (await drive.files.create({ resource })).data;
  }
  // give the new folder the right permissions
  return {
    folder: resource,
    permissionsPromise: ensurePermissions(drive, resource.id),
  };
}

async function awaitOrEnsureFolder(drive, name, parent) {
  let res;
  if (batch.DO_BATCH_PROCESSING) {
    res = await ensureFolder(drive, name, parent);
    await res.permissionsPromise;
    return res.folder;
  }
  try {
    return await awaitFolder(drive, name, parent || "root");
  } catch (error) {
    if (error.message === "never existed") {
      res = await ensureFolder(drive, name, parent);
      await res.permissionsPromise;
      return res.folder;
    }
    throw error;
  }
}

async function rmrfFolder(drive, id) {
  let resp = {};
  const ps = [];
  while (true) {
    // delete subfolders
    resp = (
      await drive.files.list({
        q: `mimeType=${quote(GDRIVE_FOLDER_MIME_TYPE)} and ${quote(
          id
        )} in parents`,
        pageSize: MAX_RESULTS,
        pageToken: resp.nextPageToken,
      })
    ).data;
    resp.files.forEach((item) => ps.push(rmrfFolder(item.id)));
    if (resp.nextPageToken == null) {
      break;
    }
  }
  while (true) {
    // delete non-folder stuff
    resp = (
      await drive.files.list({
        q: `mimeType!=${quote(GDRIVE_FOLDER_MIME_TYPE)} and ${quote(
          id
        )} in parents`,
        pageSize: MAX_RESULTS,
        pageToken: resp.nextPageToken,
      })
    ).data;
    resp.files.forEach((item) =>
      ps.push(drive.files.delete({ fileId: item.id }))
    );
    if (resp.nextPageToken == null) {
      break;
    }
  }
  await Promise.all(ps);
  // folder empty; delete the folder and we're done
  await drive.files.delete({ fileId: id });
  return "ok";
}

export class Drive {
  constructor(drive) {
    this.drive = drive;
  }
  async connect() {
    this.rootFolder = (
      await awaitOrEnsureFolder(this.drive, ROOT_FOLDER_NAME())
    ).id;
    this.ringhuntersFolder = (
      await awaitOrEnsureFolder(
        this.drive,
        `${Meteor.settings?.public?.chatName ?? "Ringhunters"} Uploads`,
        this.rootFolder
      )
    ).id;
    return this;
  }

  async createPuzzle(name) {
    const { folder, permissionsPromise } = await ensureFolder(
      this.drive,
      name,
      this.rootFolder
    );
    // is the spreadsheet already there?
    const spreadsheetP = ensure(this.drive, name, folder, spreadsheetSettings);
    const [spreadsheet, p] = await Promise.all([
      spreadsheetP,
      permissionsPromise,
    ]);
    return {
      id: folder.id,
      spreadId: spreadsheet.id,
    };
  }

  async findPuzzle(name) {
    const resp = (await
      this.drive.files.list({
        q: `name=${quote(name)} and mimeType=${quote(
          GDRIVE_FOLDER_MIME_TYPE
        )} and ${quote(this.rootFolder)} in parents`,
        pageSize: 1,
      })
    ).data;
    const folder = resp.files[0];
    if (folder == null) {
      return null;
    }
    // look for spreadsheet
    const spread = (await
      this.drive.files.list({
        q: `name=${quote(WORKSHEET_NAME(name))} and ${quote(
          folder.id
        )} in parents`,
        pageSize: 1,
      })
    );
    return {
      id: folder.id,
      spreadId: spread.data.files[0]?.id,
    };
  }

  async listPuzzles() {
    let resp = {};
    const results = [];
    while (true) {
      resp = (await
        this.drive.files.list({
          q: `mimeType=${quote(GDRIVE_FOLDER_MIME_TYPE)} and ${quote(
            this.rootFolder
          )} in parents`,
          pageSize: MAX_RESULTS,
          pageToken: resp.nextPageToken,
        })
      ).data;
      results.push(...resp.files);
      if (resp.nextPageToken == null) {
        break;
      }
    }
    return results;
  }

  async renamePuzzle(name, id, spreadId) {
    const ps = [
      this.drive.files.update({
        fileId: id,
        resource: {
          name,
        },
      }),
    ];
    if (spreadId != null) {
      ps.push(
        this.drive.files.update({
          fileId: spreadId,
          resource: {
            name: WORKSHEET_NAME(name),
          },
        })
      );
    }
    await Promise.all(ps);
    return "ok";
  }

  async deletePuzzle(id) {
    return await rmrfFolder(this.drive, id);
  }

  // purge `rootFolder` and everything in it
  async purge() {
    return await rmrfFolder(this.drive, rootFolder);
  }
}

// generate functions
const skip = (type) => () =>
  console.warn("Skipping Google Drive operation:", type);

export var FailDrive = (function () {
  FailDrive = class FailDrive {
    static initClass() {
      this.prototype.createPuzzle = skip("createPuzzle");
      this.prototype.findPuzzle = skip("findPuzzle");
      this.prototype.listPuzzles = skip("listPuzzles");
      this.prototype.renamePuzzle = skip("renamePuzzle");
      this.prototype.deletePuzzle = skip("deletePuzzle");
      this.prototype.purge = skip("purge");
    }
  };
  FailDrive.initClass();
  return FailDrive;
})();
