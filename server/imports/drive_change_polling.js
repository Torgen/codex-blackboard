import { fileType } from "/lib/imports/mime_type.js";
import { Messages, Puzzles } from "/lib/imports/collections.js";

const GDRIVE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

// Exposed for testing
export const startPageTokens = new Mongo.Collection("start_page_tokens");
startPageTokens.createIndex({ timestamp: 1 });

// Exposed for testing
// Fields:
// announced: timestamp when the existence of this file was announced in chat
export const driveFiles = new Mongo.Collection("drive_files");

// TODO: make configurable?
const POLL_INTERVAL = 60000;

const CHANGES_FIELDS =
  "nextPageToken,newStartPageToken,changes(changeType,removed,fileId,file(name,mimeType,parents,createdTime,modifiedTime,webViewLink))";

export default class DriveChangeWatcher {
  constructor(driveApi, rootDir, sharedDrive = null, env = Meteor) {
    this.driveApi = driveApi;
    this.rootDir = rootDir;
    this.sharedDrive = sharedDrive;
    this.env = env;
  }
  async start() {
    let startPageToken;
    let lastToken = await startPageTokens.findOneAsync(
      {},
      { limit: 1, sort: { timestamp: -1 } }
    );
    if (!lastToken) {
      const args = { supportsAllDrives: true };
      if (this.sharedDrive) {
        args.driveId = this.sharedDrive;
      }
      ({
        data: { startPageToken },
      } = await this.driveApi.changes.getStartPageToken(args));
      lastToken = {
        timestamp: Date.now(),
        token: startPageToken,
      };
      await startPageTokens.insertAsync(lastToken);
    }
    this.startPageToken = lastToken.token;
    this.lastPoll = lastToken.timestamp;
    this.timeoutHandle = this.env.setTimeout(
      () => this.poll(),
      Math.max(0, lastToken.timestamp + POLL_INTERVAL - Date.now())
    );
  }

  async poll() {
    let puzzle;
    let token = this.startPageToken;
    const pollStart = Date.now();
    try {
      let created, data, updates;
      const promises = [];
      while (true) {
        ({ data } = await this.driveApi.changes.list({
          pageToken: token,
          pageSize: 1000,
          fields: CHANGES_FIELDS,
          supportsAllDrives: true,
          includeItemsFromAllDrives: this.sharedDrive != null,
          driveId: this.sharedDrive,
        }));
        updates = new Map(); // key: puzzle id, value: max modifiedTime of file with it as parent
        created = new Map(); // key: file ID, value: {name, mimeType, webViewLink, channel}
        promises.push(
          ...data.changes.map(async ({ changeType, removed, fileId, file }) => {
            if (changeType !== "file") {
              return;
            }
            if (removed) {
              return;
            }
            const {
              name,
              mimeType,
              parents,
              createdTime,
              modifiedTime,
              webViewLink,
            } = file;
            if (parents == null) {
              return;
            }
            let moddedAt = Date.parse(modifiedTime);
            const createdAt = Date.parse(createdTime);
            let channel = null;
            let puzzleId = null;
            // Uploads can have a created time of when they're uploaded, but a modified time of
            // whatever the file being uploaded had.
            if (createdAt > moddedAt) {
              moddedAt = createdAt;
            }
            if (parents.includes(this.rootDir)) {
              channel = "general/0";
            } else {
              puzzle = await Puzzles.findOneAsync({
                drive: { $in: parents },
              });
              if (puzzle == null) {
                return;
              }
              puzzleId = puzzle._id;
              if (puzzle.spreadsheet !== fileId && puzzle.doc !== fileId) {
                channel = `puzzles/${puzzleId}`;
              }
            }
            if (puzzleId != null) {
              let update = updates.get(puzzleId);
              if (update == null) {
                update = {};
                updates.set(puzzleId, update);
              }
              // Not the same as timestamp <= moddedAt! update.timestamp might be undefined
              if (!(update.timestamp > moddedAt)) {
                update.timestamp = moddedAt;
              }
              if (
                mimeType === GDRIVE_DOC_MIME_TYPE &&
                puzzle != null &&
                puzzle.doc == null
              ) {
                if (update.doc == null) {
                  update.doc = fileId;
                }
              }
            }
            if (channel != null) {
              if (
                (await driveFiles.findOneAsync({ _id: fileId }))?.announced ==
                null
              ) {
                return created.set(fileId, {
                  name,
                  mimeType,
                  webViewLink,
                  channel,
                });
              }
            }
          })
        );
        if (data.nextPageToken != null) {
          token = data.nextPageToken;
        } else if (data.newStartPageToken != null) {
          break;
        } else {
          throw new Error(
            "Response had neither nextPageToken nor newStartPageToken"
          );
        }
      }
      await Promise.all(promises);
      const bulkPuzzleUpdates = [];
      for (const [puzzle, { timestamp, doc }] of updates) {
        const updateDoc = { $max: { drive_touched: timestamp } };
        if (doc != null) {
          updateDoc.$set = { doc };
        }
        bulkPuzzleUpdates.push({
          updateOne: {
            filter: { _id: puzzle },
            update: updateDoc,
          },
        });
        console.log(puzzle, updateDoc);
      }
      const puzzlePromise = bulkPuzzleUpdates.length
        ? Puzzles.rawCollection().bulkWrite(bulkPuzzleUpdates, {
            ordered: false,
          })
        : Promise.resolve();
      const mapPromises = [];
      created.forEach(function (
        { name, mimeType, webViewLink, channel },
        fileId
      ) {
        mapPromises.push(
          (async function () {
            // Would be nice to use bulk write here, but since we're not forcing a particular ID
            // we could have mismatched meteor vs. mongo ID types.
            const now = Date.now();
            await Messages.insertAsync({
              body: `${fileType(
                mimeType
              )} \"${name}\" added to drive folder: ${webViewLink}`,
              system: true,
              room_name: channel,
              bot_ignore: true,
              useful: true,
              file_upload: { name, mimeType, webViewLink, fileId },
              timestamp: now,
            });
            await driveFiles.upsertAsync(fileId, { $max: { announced: now } });
          })()
        );
      });
      await Promise.all(mapPromises);
      await puzzlePromise;
      this.lastPoll = pollStart;
      this.startPageToken = data.newStartPageToken;
      await startPageTokens.upsertAsync(
        {},
        {
          $set: {
            timestamp: pollStart,
            token: data.newStartPageToken,
          },
        },
        {
          multi: false,
          sort: { timestamp: 1 },
        }
      );
    } catch (e) {
      console.error(e);
    }
    this.env.clearTimeout(this.timeoutHandle);
    this.timeoutHandle = this.env.setTimeout(() => this.poll(), POLL_INTERVAL);
  }

  stop() {
    this.env.clearTimeout(this.timeoutHandle);
  }
}
