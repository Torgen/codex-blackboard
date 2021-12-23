'use strict'

model = share.model

Template.calendar_dropdown.helpers
  calendar_id: -> model.Calendar.findOne()?._id
  next_event: ->
    now = Session.get 'currentTime'
    model.CalendarEvents.findOne({end: $gt: now}, {sort: start: 1})?.start - now
  upcoming_events: -> model.CalendarEvents.find {end: $gt: Session.get 'currentTime'}, {sort: start: 1}
  url: (str) ->
    try
      new URL str
      return true
    catch e
      return false
