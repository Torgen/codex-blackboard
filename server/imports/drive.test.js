import chai from "chai";
import sinon from "sinon";
import { Drive } from "./drive.js";
import { Readable } from "stream";

import * as batch from "/server/imports/batch.js";

const OWNER_PERM = {
  role: "writer",
  type: "user",
  emailAddress: "foo@bar.baz",
};

const EVERYONE_PERM = {
  // edit permissions for anyone with link
  allowFileDiscovery: false,
  role: "writer",
  type: "anyone",
};

const PERMISSION_LIST_FIELDS =
  "permissions(role,type,emailAddress,allowFileDiscovery)";

const defaultPerms = [EVERYONE_PERM, OWNER_PERM];

describe("drive", function () {
  let clock = null;
  let api = null;
  let files = null;
  let permissions = null;

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    api = {
      files: {
        create() {},
        delete() {},
        list() {},
        update() {},
      },
      permissions: {
        list() {},
        create() {},
      },
    };
    files = sinon.mock(api.files);
    permissions = sinon.mock(api.permissions);
    Meteor.settings.folder = "Test Folder";
  });

  afterEach(function () {
    clock.restore();
    sinon.verifyAndRestore();
  });

  it("propagates errors", function () {
    sinon.replace(batch, "DO_BATCH_PROCESSING", false);
    files.expects("list").once().rejects({ code: 400 });
    chai.assert.throws(() => new Drive(api));
  });

  function testCase(perms) {
    it("creates folder when batch is enabled", function () {
      sinon.replace(batch, "DO_BATCH_PROCESSING", true);
      files
        .expects("list")
        .withArgs(
          sinon.match({
            q: "name='Test Folder' and 'root' in parents",
            pageSize: 1,
          }),
        )
        .resolves({ data: { files: [] } });
      files
        .expects("create")
        .withArgs(
          sinon.match({
            resource: {
              name: "Test Folder",
              mimeType: "application/vnd.google-apps.folder",
            },
          }),
        )
        .resolves({
          data: {
            id: "hunt",
            name: "Test Folder",
            mimeType: "application/vnd.google-apps.folder",
          },
        });
      permissions
        .expects("list")
        .withArgs(
          sinon.match({
            fileId: "hunt",
            fields: PERMISSION_LIST_FIELDS,
          }),
        )
        .resolves({ data: { permissions: [] } });
      perms.forEach((perm) =>
        permissions
          .expects("create")
          .withArgs(
            sinon.match({
              fileId: "hunt",
              resource: perm,
            }),
          )
          .resolves({ data: {} }),
      );
      files
        .expects("list")
        .withArgs(
          sinon.match({
            q: "name='Ringhunters Uploads' and 'hunt' in parents",
            pageSize: 1,
          }),
        )
        .resolves({ data: { files: [] } });
      files
        .expects("create")
        .withArgs(
          sinon.match({
            resource: {
              name: "Ringhunters Uploads",
              mimeType: "application/vnd.google-apps.folder",
              parents: sinon.match.some(sinon.match("hunt")),
            },
          }),
        )
        .resolves({
          data: {
            id: "uploads",
            name: "Ringhunters Uploads",
            mimeType: "application/vnd.google-apps.folder",
          },
        });
      permissions
        .expects("list")
        .withArgs(
          sinon.match({
            fileId: "uploads",
            fields: PERMISSION_LIST_FIELDS,
          }),
        )
        .resolves({ data: { permissions: [] } });
      perms.forEach((perm) =>
        permissions
          .expects("create")
          .withArgs(
            sinon.match({
              fileId: "uploads",
              resource: perm,
            }),
          )
          .resolves({ data: {} }),
      );
      return new Drive(api);
    });

    describe("with batch disabled", function () {
      let drive = null;
      beforeEach(function () {
        sinon.replace(batch, "DO_BATCH_PROCESSING", false);
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "name='Test Folder' and 'root' in parents",
              pageSize: 1,
            }),
          )
          .resolves({
            data: {
              files: [
                {
                  id: "hunt",
                  name: "Test Folder",
                  mimeType: "application/vnd.google-apps.folder",
                },
              ],
            },
          });
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "name='Ringhunters Uploads' and 'hunt' in parents",
              pageSize: 1,
            }),
          )
          .resolves({
            data: {
              files: [
                {
                  id: "uploads",
                  name: "Ringhunters Uploads",
                  mimeType: "application/vnd.google-apps.folder",
                  parents: ["hunt"],
                },
              ],
            },
          });
        drive = new Drive(api);
      });

      describe("createPuzzle", function () {
        it("creates", function () {
          files
            .expects("list")
            .withArgs(
              sinon.match({
                q: "name='New Puzzle' and 'hunt' in parents",
                pageSize: 1,
              }),
            )
            .resolves({ data: { files: [] } });
          files
            .expects("create")
            .withArgs(
              sinon.match({
                resource: {
                  name: "New Puzzle",
                  mimeType: "application/vnd.google-apps.folder",
                  parents: sinon.match.some(sinon.match("hunt")),
                },
              }),
            )
            .resolves({
              data: {
                id: "newpuzzle",
                name: "New Puzzle",
                mimeType: "application/vnd.google-apps.folder",
                parents: ["hunt"],
              },
            });
          permissions
            .expects("list")
            .withArgs(
              sinon.match({
                fileId: "newpuzzle",
                fields: PERMISSION_LIST_FIELDS,
              }),
            )
            .resolves({ data: { permissions: [] } });
          perms.forEach((perm) =>
            permissions
              .expects("create")
              .withArgs(
                sinon.match({
                  fileId: "newpuzzle",
                  resource: perm,
                }),
              )
              .resolves({ data: {} }),
          );
          files
            .expects("list")
            .withArgs(
              sinon.match({
                pageSize: 1,
                q: "name='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet' and 'newpuzzle' in parents",
              }),
            )
            .resolves({ data: { files: [] } });
          const sheet = sinon.match({
            name: "Worksheet: New Puzzle",
            mimeType: "application/vnd.google-apps.spreadsheet",
            parents: sinon.match.some(sinon.match("newpuzzle")),
          });
          files
            .expects("create")
            .withArgs(
              sinon.match({
                resource: sheet,
                media: sinon.match({
                  mimeType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  body: sinon.match.instanceOf(Readable),
                }),
              }),
            )
            .resolves({
              data: {
                id: "newsheet",
                name: "Worksheet: New Puzzle",
                mimeType: "application/vnd.google-apps.spreadsheet",
                parents: ["newpuzzle"],
              },
            });
          permissions
            .expects("list")
            .withArgs(
              sinon.match({
                fileId: "newsheet",
                fields: PERMISSION_LIST_FIELDS,
              }),
            )
            .resolves({ data: { permissions: [] } });
          perms.forEach((perm) =>
            permissions
              .expects("create")
              .withArgs(
                sinon.match({
                  fileId: "newsheet",
                  resource: perm,
                }),
              )
              .resolves({ data: {} }),
          );
          drive.createPuzzle("New Puzzle");
        });

        it("returns existing", function () {
          files
            .expects("list")
            .withArgs(
              sinon.match({
                q: "name='New Puzzle' and 'hunt' in parents",
                pageSize: 1,
              }),
            )
            .resolves({
              data: {
                files: [
                  {
                    id: "newpuzzle",
                    name: "New Puzzle",
                    mimeType: "application/vnd.google-apps.folder",
                    parents: ["hunt"],
                  },
                ],
              },
            });
          permissions
            .expects("list")
            .withArgs(
              sinon.match({
                fileId: "newpuzzle",
                fields: PERMISSION_LIST_FIELDS,
              }),
            )
            .resolves({ data: { permissions: defaultPerms } });
          files
            .expects("list")
            .withArgs(
              sinon.match({
                pageSize: 1,
                q: "name='Worksheet: New Puzzle' and mimeType='application/vnd.google-apps.spreadsheet' and 'newpuzzle' in parents",
              }),
            )
            .resolves({
              data: {
                files: [
                  {
                    id: "newsheet",
                    name: "Worksheet: New Puzzle",
                    mimeType: "application/vnd.google-apps.spreadsheet",
                    parents: ["newpuzzle"],
                  },
                ],
              },
            });
          permissions
            .expects("list")
            .withArgs(
              sinon.match({
                fileId: "newsheet",
                fields: PERMISSION_LIST_FIELDS,
              }),
            )
            .resolves({ data: { permissions: defaultPerms } });
          drive.createPuzzle("New Puzzle");
        });
      });

      describe("findPuzzle", function () {
        it("returns null when no puzzle", function () {
          files
            .expects("list")
            .withArgs(
              sinon.match({
                q: "name='New Puzzle' and mimeType='application/vnd.google-apps.folder' and 'hunt' in parents",
                pageSize: 1,
              }),
            )
            .resolves({ data: { files: [] } });
          chai.assert.isNull(drive.findPuzzle("New Puzzle"));
        });

        it("returns spreadsheet", function () {
          files
            .expects("list")
            .withArgs(
              sinon.match({
                q: "name='New Puzzle' and mimeType='application/vnd.google-apps.folder' and 'hunt' in parents",
                pageSize: 1,
              }),
            )
            .resolves({
              data: {
                files: [
                  {
                    id: "newpuzzle",
                    name: "New Puzzle",
                    mimeType: "application/vnd.google-apps.folder",
                    parents: ["hunt"],
                  },
                ],
              },
            });
          files
            .expects("list")
            .withArgs(
              sinon.match({
                pageSize: 1,
                q: "name='Worksheet: New Puzzle' and 'newpuzzle' in parents",
              }),
            )
            .resolves({
              data: {
                files: [
                  {
                    id: "newsheet",
                    name: "Worksheet: New Puzzle",
                    mimeType: "application/vnd.google-apps.spreadsheet",
                    parents: ["newpuzzle"],
                  },
                ],
              },
            });
          chai.assert.include(drive.findPuzzle("New Puzzle"), {
            id: "newpuzzle",
            spreadId: "newsheet",
          });
        });
      });

      it("listPuzzles returns list", function () {
        const item1 = {
          id: "newpuzzle",
          name: "New Puzzle",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["hunt"],
        };
        const item2 = {
          id: "oldpuzzle",
          name: "Old Puzzle",
          mimeType: "application/vnd.google-apps.folder",
          parents: ["hunt"],
        };
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "mimeType='application/vnd.google-apps.folder' and 'hunt' in parents",
              pageSize: 200,
            }),
          )
          .resolves({
            data: {
              files: [item1],
              nextPageToken: "token",
            },
          });
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "mimeType='application/vnd.google-apps.folder' and 'hunt' in parents",
              pageSize: 200,
              pageToken: "token",
            }),
          )
          .resolves({
            data: {
              files: [item2],
            },
          });
        chai.assert.sameDeepOrderedMembers(drive.listPuzzles(), [item1, item2]);
      });

      it("renamePuzzle renames", function () {
        files
          .expects("update")
          .withArgs(
            sinon.match({
              fileId: "newpuzzle",
              resource: sinon.match({ name: "Old Puzzle" }),
            }),
          )
          .resolves({ data: {} });
        files
          .expects("update")
          .withArgs(
            sinon.match({
              fileId: "newsheet",
              resource: sinon.match({ name: "Worksheet: Old Puzzle" }),
            }),
          )
          .resolves({ data: {} });
        drive.renamePuzzle("Old Puzzle", "newpuzzle", "newsheet");
      });

      it("deletePuzzle deletes", function () {
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "mimeType='application/vnd.google-apps.folder' and 'newpuzzle' in parents",
              pageSize: 200,
            }),
          )
          .resolves({ data: { files: [] } }); // Puzzles don't have folders
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "mimeType!='application/vnd.google-apps.folder' and 'newpuzzle' in parents",
              pageSize: 200,
            }),
          )
          .resolves({
            data: {
              files: [
                {
                  id: "newsheet",
                  name: "Worksheet: New Puzzle",
                  mimeType: "application/vnd.google-apps.spreadsheet",
                  parents: ["newpuzzle"],
                },
              ],
              nextPageToken: "token",
            },
          });
        files
          .expects("delete")
          .withArgs(
            sinon.match({
              fileId: "newsheet",
            }),
          )
          .resolves({ data: {} });
        files
          .expects("list")
          .withArgs(
            sinon.match({
              q: "mimeType!='application/vnd.google-apps.folder' and 'newpuzzle' in parents",
              pageSize: 200,
              pageToken: "token",
            }),
          )
          .resolves({
            data: {
              files: [
                {
                  id: "newdoc",
                  name: "Notes: New Puzzle",
                  mimeType: "application/vnd.google-apps.document",
                  parents: ["newpuzzle"],
                },
              ],
            },
          });
        files
          .expects("delete")
          .withArgs(
            sinon.match({
              fileId: "newdoc",
            }),
          )
          .resolves({ data: {} });
        files
          .expects("delete")
          .withArgs(
            sinon.match({
              fileId: "newpuzzle",
            }),
          )
          .resolves({ data: {} });
        drive.deletePuzzle("newpuzzle");
      });
    });
  }
  describe("with drive owner set", function () {
    beforeEach(function () {
      Meteor.settings.driveowner = "foo@bar.baz";
      Meteor.settings.drive_share_group = undefined;
    });

    testCase(defaultPerms);
  });

  describe("with no drive owner set", function () {
    beforeEach(() => (Meteor.settings.driveowner = undefined));

    testCase([EVERYONE_PERM]);
  });
});
