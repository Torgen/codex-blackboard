import { NonEmptyString, ObjectWith } from "/lib/imports/match.js";
import { CalendarEvents, collection } from "/lib/imports/collections.js";

Accounts.removeDefaultRateLimit();

Meteor.methods({
  wait() {},
  setAnyField(args) {
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
    collection(args.type).update(args.object, { $set: args.fields });
    return true;
  },
  newCalendarEvent(args) {
    check(this.userId, NonEmptyString);
    return CalendarEvents.insert(args);
  },
  deleteCalendarEvent(_id) {
    check(this.userId, NonEmptyString);
    CalendarEvents.remove({ _id });
  },
});
