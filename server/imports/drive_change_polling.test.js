// For side effects
import "/lib/model.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import DriveChangeWatcher, {
  startPageTokens,
  driveFiles,
} from "./drive_change_polling.js";
import { clearCollections } from "/lib/imports/testutils.js";

const SPREADSHEET_TYPE = "application/vnd.google-apps.spreadsheet";
const DOC_TYPE = "application/vnd.google-apps.document";

describe("drive change polling", function () {
  this.timeout(10000);

  let clock = null;
  let api = null;
  let changes = null;
  let poller = null;
  let env = null;

  beforeEach(async function () {
    await clearCollections(Messages, Puzzles, startPageTokens, driveFiles);
    clock = sinon.useFakeTimers({
      now: 60007,
      toFake: ["Date"],
    });

    env = {
      setTimeout: sinon.stub(),
      clearTimeout: sinon.stub(),
    };

    api = {
      changes: {
        list() {},
        getStartPageToken() {},
      },
    };
    changes = sinon.mock(api.changes);
  });

  afterEach(function () {
    clock.restore();
  });

  afterEach(() => sinon.verifyAndRestore());

  describe("normal folder", function () {
    beforeEach(function () {
      poller = new DriveChangeWatcher(api, "root_folder", null, env);
    });

    afterEach(function () {
      poller?.stop();
    });

    it("fetches page token when never polled", async function () {
      changes
        .expects("getStartPageToken")
        .once()
        .withArgs({ supportsAllDrives: true })
        .resolves({ data: { startPageToken: "firstPage" } });
      await poller.start();
      chai.assert.include(await startPageTokens.findOneAsync(), {
        timestamp: 60007,
        token: "firstPage",
      });
    });

    it("polls immediately when poll is overdue", async function () {
      await startPageTokens.insertAsync({
        timestamp: 7,
        token: "firstPage",
      });
      await poller.start();
      chai.assert.equal(env.setTimeout.firstCall.lastArg, 0);
    });

    it("waits to poll", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await poller.start();
      chai.assert.equal(env.setTimeout.firstCall.lastArg, 30000);
    });

    it("updates puzzle and does not announce when spreadsheet updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        doc: "foo_doc",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_sheet",
                file: {
                  name: "Worksheet: Foo",
                  mimeType: SPREADSHEET_TYPE,
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
      });
      chai.assert.isUndefined(await Messages.findOneAsync());
    });

    it("updates puzzle and does not announce when doc updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        doc: "foo_doc",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_doc",
                file: {
                  name: "Notes: Foo",
                  mimeType: DOC_TYPE,
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
      });
      chai.assert.isUndefined(await Messages.findOneAsync());
    });

    it("updates puzzle and announces when new file updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        doc: "foo_doc",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
      });
      chai.assert.include(await driveFiles.findOneAsync("foo_other"), {
        announced: 60007,
      });
      chai.assert.deepInclude(await Messages.findOneAsync(), {
        room_name: `puzzles/${puzz}`,
        system: true,
        file_upload: {
          mimeType: "image/svg+xml",
          webViewLink: "https://blahblahblah.com",
          name: "Drawing about Foo",
          fileId: "foo_other",
        },
      });
    });

    it("updates puzzle announces and sets doc when new doc updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_doc",
                file: {
                  name: "Notes: Foo",
                  mimeType: DOC_TYPE,
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
        doc: "foo_doc",
      });
      chai.assert.include(await driveFiles.findOneAsync("foo_doc"), {
        announced: 60007,
      });
      chai.assert.deepInclude(await Messages.findOneAsync(), {
        room_name: `puzzles/${puzz}`,
        system: true,
        file_upload: {
          mimeType: DOC_TYPE,
          webViewLink: "https://blahblahblah.com",
          name: "Notes: Foo",
          fileId: "foo_doc",
        },
      });
    });

    it("updates puzzle and does not announce when announced file updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await driveFiles.insertAsync({
        _id: "foo_other",
        announced: 5,
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        doc: "foo_doc",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
      });
      chai.assert.isUndefined(await Messages.findOneAsync());
    });

    it("announces in general chat when new file updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["root_folder"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await driveFiles.findOneAsync("foo_other"), {
        announced: 60007,
      });
      chai.assert.deepInclude(await Messages.findOneAsync(), {
        room_name: "general/0",
        system: true,
        file_upload: {
          mimeType: "image/svg+xml",
          webViewLink: "https://blahblahblah.com",
          name: "Drawing about Foo",
          fileId: "foo_other",
        },
      });
    });

    it("does not announce in general chat when announced file updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await driveFiles.insertAsync({
        _id: "foo_other",
        announced: 5,
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["root_folder"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.isUndefined(await Messages.findOneAsync());
    });

    it("does not announce when new file updated in unknown folder", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: false,
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["somewhere_else"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.isUndefined(await Messages.findOneAsync());
    });

    // Test when initial poll fails, polls are rescheduled

    it("calls again with next page token", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await poller.start();
      const list = changes
        .expects("list")
        .twice()
        .onFirstCall()
        .resolves({
          data: {
            nextPageToken: "continue",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["root_folder"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        })
        .onSecondCall()
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "unknown_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["somewhere_else"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.deepInclude(await Messages.findOneAsync(), {
        room_name: "general/0",
        system: true,
        file_upload: {
          mimeType: "image/svg+xml",
          webViewLink: "https://blahblahblah.com",
          name: "Drawing about Foo",
          fileId: "foo_other",
        },
      });
      chai.assert.include(list.getCall(0).args[0], { pageToken: "firstPage" });
      chai.assert.include(list.getCall(1).args[0], { pageToken: "continue" });
      chai.assert.include(await startPageTokens.findOneAsync(), {
        timestamp: 60007,
        token: "secondPage",
      });
    });

    it("does not announce when failure on next page token", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      await poller.start();
      const list = changes
        .expects("list")
        .twice()
        .onFirstCall()
        .resolves({
          data: {
            nextPageToken: "continue",
            changes: [
              {
                changeType: "file",
                fileId: "foo_other",
                file: {
                  name: "Drawing about Foo",
                  mimeType: "image/svg+xml",
                  parents: ["root_folder"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        })
        .onSecondCall()
        .rejects("error");
      await poller.poll();
      chai.assert.isUndefined(await Messages.findOneAsync());
      chai.assert.include(list.getCall(0).args[0], { pageToken: "firstPage" });
      chai.assert.include(list.getCall(1).args[0], { pageToken: "continue" });
      chai.assert.include(await startPageTokens.findOneAsync(), {
        timestamp: 30007,
        token: "firstPage",
      });
    });
  });

  describe("shared folder", function () {
    beforeEach(function () {
      poller = new DriveChangeWatcher(
        api,
        "root_folder",
        "aFolderThatIsShared",
        env
      );
    });

    afterEach(function () {
      poller?.stop();
    });

    it("fetches page token when never polled", async function () {
      changes
        .expects("getStartPageToken")
        .once()
        .withArgs({ supportsAllDrives: true, driveId: "aFolderThatIsShared" })
        .resolves({ data: { startPageToken: "firstPage" } });
      await poller.start();
      chai.assert.include(await startPageTokens.findOneAsync(), {
        timestamp: 60007,
        token: "firstPage",
      });
    });

    it("updates puzzle and does not announce when spreadsheet updated", async function () {
      await startPageTokens.insertAsync({
        timestamp: 30007,
        token: "firstPage",
      });
      const puzz = await Puzzles.insertAsync({
        name: "Foo",
        canon: "foo",
        drive: "foo_drive",
        doc: "foo_doc",
        spreadsheet: "foo_sheet",
      });
      await poller.start();
      changes
        .expects("list")
        .once()
        .withArgs(
          sinon.match({
            pageToken: "firstPage",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            driveId: "aFolderThatIsShared",
          })
        )
        .resolves({
          data: {
            newStartPageToken: "secondPage",
            changes: [
              {
                changeType: "file",
                fileId: "foo_sheet",
                file: {
                  name: "Worksheet: Foo",
                  mimeType: SPREADSHEET_TYPE,
                  parents: ["foo_drive"],
                  createdTime: "1970-01-01T00:00:31.006Z",
                  modifiedTime: "1970-01-01T00:00:31.006Z",
                  webViewLink: "https://blahblahblah.com",
                },
              },
            ],
          },
        });
      await poller.poll();
      chai.assert.include(await Puzzles.findOneAsync({ canon: "foo" }), {
        drive_touched: 31006,
      });
      chai.assert.isUndefined(await Messages.findOneAsync());
    });
  });
});
