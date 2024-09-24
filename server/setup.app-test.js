import { NonEmptyString, ObjectWith } from "/lib/imports/match.js";
import { CalendarEvents, collection } from "/lib/imports/collections.js";

Accounts.removeDefaultRateLimit();

Meteor.methods({
  wait() {},
  async setAnyField(args) {
    check(this.userId, NonEmptyString);
    check(
      args,
      ObjectWith({
        type: NonEmptyString,
        object: NonEmptyString,
        fields: Object,
      })
    );
    const now = Date.now();
    args.fields.touched = now;
    args.fields.touched_by = this.userId;
    await collection(args.type).updateAsync(args.object, { $set: args.fields });
    return true;
  },
  async newCalendarEvent(args) {
    check(this.userId, NonEmptyString);
    return await CalendarEvents.insertAsync(args);
  },
  async deleteCalendarEvent(_id) {
    check(this.userId, NonEmptyString);
    await CalendarEvents.removeAsync({ _id });
  },
});
