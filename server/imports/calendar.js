import {
  ROOT_FOLDER_NAME,
  CODEX_ACCOUNT,
  SHARE_GROUP,
} from "./googlecommon.js";
import { Calendar, CalendarEvents } from "/lib/imports/collections.js";

// Cambridge is on Eastern time.
const CALENDAR_TIME_ZONE =
  Meteor.settings.calendar?.time_zone ||
  process.env.CALENDAR_TIME_ZONE ||
  "America/New_York";

// TODO: make configurable?
const POLL_INTERVAL = 30000;

export class CalendarSync {
  constructor(api) {
    this.api = api;
    let cal = Calendar.findOne();

    if (cal != null) {
      this.id = cal._id;
      this.syncToken = cal.syncToken;
      console.log(`Using existing calendar ${this.id}`);
    } else {
      this.syncToken = null;

      this.id = Promise.await(
        (async () => {
          // See if one exists
          let pageToken = null;
          while (true) {
            const res = (await this.api.calendarList.list({ pageToken })).data;
            for (let item of res.items) {
              if (item.summary === ROOT_FOLDER_NAME()) {
                console.log(`Found calendar ${item.id}`);
                return item.id;
              }
            }
            if (!(pageToken = res.nextPageToken)) {
              break;
            }
          }
          // Apparently not, so make one.
          cal = (
            await this.api.calendars.insert({
              requestBody: {
                summary: ROOT_FOLDER_NAME(),
                timeZone: CALENDAR_TIME_ZONE,
              },
            })
          ).data;
          console.log(`Made calendar ${cal.id}`);
          return cal.id;
        })()
      );

      Calendar.insert({ _id: this.id });
    }

    const promises = [this._pollAndReschedule()];
    const acls = Promise.await(
      this.api.acl.list({ calendarId: this.id, maxResults: 250 })
    );
    if (
      !acls.data.items.some(
        (x) => x.role === "reader" && x.scope.type === "default"
      )
    ) {
      // Ensure public. (default can't be writer.)
      promises.push(
        this.api.acl.insert({
          calendarId: this.id,
          requestBody: {
            role: "reader",
            scope: {
              type: "default",
            },
          },
        })
      );
    }
    const writer = SHARE_GROUP();
    if (writer != null) {
      if (
        !acls.data.items.some(
          (x) =>
            x.role === "writer" &&
            x.scope.type === "group" &&
            x.scope.value === writer
        )
      ) {
        // Allow group to write.
        promises.push(
          this.api.acl.insert({
            calendarId: this.id,
            sendNotifications: false,
            requestBody: {
              role: "writer",
              scope: {
                type: "group",
                value: writer,
              },
            },
          })
        );
      }
    }
    const owner = CODEX_ACCOUNT();
    if (owner != null) {
      if (
        !acls.data.items.some(
          (x) =>
            x.role === "owner" &&
            x.scope.type === "user" &&
            x.scope.value === owner
        )
      ) {
        // Make codex account an owner
        promises.push(
          this.api.acl.insert({
            calendarId: this.id,
            sendNotifications: false,
            requestBody: {
              role: "owner",
              scope: {
                type: "user",
                value: owner,
              },
            },
          })
        );
      }
    }
    Promise.await(Promise.all(promises));
  }

  async pollOnce() {
    let update;
    let pageToken = null;
    const bulkEventUpdates = [];
    while (true) {
      let events = null;
      try {
        events = (
          await this.api.events.list({
            calendarId: this.id,
            pageToken,
            syncToken: pageToken != null ? null : this.syncToken,
          })
        ).data;
      } catch (e) {
        if (e.code === 410 && this.syncToken != null) {
          this.syncToken = null;
          continue;
        }
        throw e;
      }
      for (var event of events.items) {
        if (event.status === "cancelled") {
          bulkEventUpdates.push({
            deleteOne: { filter: { _id: event.id } },
          });
        } else {
          update = {};
          var set = {};
          var unset = {};
          if (event.end?.dateTime != null) {
            set.end = Date.parse(event.end?.dateTime);
            update.$set = set;
          }
          if (event.start?.dateTime != null) {
            set.start = Date.parse(event.start?.dateTime);
            update.$set = set;
          }
          const setUnset = function (eventKey, documentKey) {
            if (event[eventKey] != null) {
              set[documentKey] = event[eventKey];
              update.$set = set;
            } else {
              unset[documentKey] = "";
              update.$unset = unset;
            }
          };
          setUnset("summary", "summary");
          setUnset("location", "location");
          setUnset("description", "description");
          setUnset("htmlLink", "link");
          bulkEventUpdates.push({
            updateOne: {
              filter: { _id: event.id },
              upsert: true,
              update,
            },
          });
        }
      }
      if (events.nextPageToken != null) {
        console.log(events.nextPageToken);
        pageToken = events.nextPageToken;
      } else {
        this.syncToken = events.nextSyncToken;
        break;
      }
    }
    const bulkUpdates = bulkEventUpdates.length
      ? CalendarEvents.rawCollection().bulkWrite(bulkEventUpdates, {
          ordered: false,
        })
      : Promise.resolve();
    const updateSync = Calendar.rawCollection().update(
      { _id: this.id },
      { $set: { syncToken: this.syncToken } }
    );
    await Promise.all([bulkUpdates, updateSync]);
  }

  async _pollAndReschedule() {
    try {
      await this.pollOnce();
    } catch (e) {
      console.warn(e);
    }
    this._schedulePoll();
  }

  _schedulePoll(interval = POLL_INTERVAL) {
    this.stop();
    this.timeoutHandle = Meteor.setTimeout(
      () => this._pollAndReschedule(),
      interval
    );
  }

  stop() {
    if (this.timeoutHandle != null) {
      Meteor.clearTimeout(this.timeoutHandle);
    }
  }
}
