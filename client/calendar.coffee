'use strict'

model = share.model

Template.calendar_dropdown.helpers
  calendar_id: -> model.Calendar.findOne()?._id
  next_event: ->
    now = Session.get 'currentTime'
    model.CalendarEvents.findOne({end: $gt: now}, {sort: start: 1})?.start - now
  upcoming_events: -> model.CalendarEvents.find {end: $gt: Session.get 'currentTime'}, {sort: start: 1}

Template.calendar_event.helpers
  url: (str) ->
    try
      new URL str
      return true
    catch e
      return false

Template.calendar_attachable_events.helpers
  attachable_events: ->
    model.CalendarEvents.find
      end: $gt: Session.get 'currentTime'
      puzzle: null
    ,
      sort: start: 1
      fields:
        puzzle: 0
        location: 0

Template.calendar_attachable_events.events
  'click [data-event-id]': (event, template) ->
    Meteor.call 'setPuzzleForEvent', event.currentTarget.dataset.eventId, template.data.puzzle
