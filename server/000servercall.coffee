'use strict'

# Allow impersonating a user from the server side when not already in a call.
Meteor.callAs = (method, userId, args...) ->
  throw Meteor.Error(400, 'already in call') if DDP._CurrentMethodInvocation.get()
  DDP._CurrentMethodInvocation.withValue {userId}, -> Meteor.call method, args...
