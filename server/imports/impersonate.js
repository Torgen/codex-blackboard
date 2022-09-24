'use strict'

export impersonating = (userId, f) ->
  throw Meteor.Error(400, 'already in call') if DDP._CurrentMethodInvocation.get()
  DDP._CurrentMethodInvocation.withValue {userId}, -> f()

export callAs = (method, user, args...) -> impersonating user, -> Meteor.call method, args...
