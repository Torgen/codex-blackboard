import { Calendar, CalendarEvents } from "/lib/imports/collections.js";

function calendar_container(template) {
  template.helpers({
    calendar_id() {
      return Calendar.findOne()?._id;
    },
    upcoming_events() {
      return CalendarEvents.find(
        { end: { $gt: Session.get("currentTime") } },
        { sort: { start: 1 } }
      );
    },
  });
}

calendar_container(Template.calendar_dropdown);
Template.calendar_dropdown.helpers({
  next_event() {
    const now = Session.get("currentTime");
    return (
      CalendarEvents.findOne({ end: { $gt: now } }, { sort: { start: 1 } })
        ?.start - now
    );
  },
});

calendar_container(Template.calendar_link);
calendar_container(Template.calendar_add_link);
calendar_container(Template.calendar_strip);
calendar_container(Template.calendar_column);

Template.calendar_event.helpers({
  dh_until_start() {
    return (this.event.start - Session.get("currentTime")) / 360000;
  },
  url(str) {
    try {
      new URL(str);
      return true;
    } catch (e) {
      return false;
    }
  },
});

Template.calendar_event.events({
  "click .bb-event-unattend"(event, template) {
    Meteor.serializeCall(
      "removeEventAttendee",
      template.data.event._id,
      Meteor.userId()
    );
  },
  "click .bb-event-attend"(event, template) {
    Meteor.serializeCall(
      "addEventAttendee",
      template.data.event._id,
      Meteor.userId()
    );
  },
  "click .bb-detach-event"(event, template) {
    Meteor.serializeCall("setPuzzleForEvent", template.data.event._id, null);
  },
});

function attachable_events() {
  CalendarEvents.find(
    {
      end: { $gt: Session.get("currentTime") },
      puzzle: null,
    },
    {
      sort: { start: 1 },
      fields: {
        puzzle: 0,
        location: 0,
      },
    }
  );
}

Template.calendar_attachable_events.helpers({ attachable_events });

Template.calendar_attachable_events.events({
  "click [data-event-id]"(event, template) {
    Meteor.serializeCall(
      "setPuzzleForEvent",
      event.currentTarget.dataset.eventId,
      template.data.puzzle
    );
  },
});

function calendar_puzzle_container(template) {
  template.helpers({
    upcoming_events() {
      return CalendarEvents.find(
        {
          end: { $gt: Session.get("currentTime") },
          puzzle: this._id,
        },
        { sort: { start: 1 } }
      );
    },
  });
}

calendar_puzzle_container(Template.calendar_puzzle_cell);
calendar_puzzle_container(Template.calendar_puzzle_events);

Template.calendar_puzzle_cell.helpers({ attachable_events });

Template.calendar_puzzle_cell_entry.events({
  "click .bb-detach-event"(event, template) {
    Meteor.serializeCall("setPuzzleForEvent", template.data.event._id, null);
  },
});
