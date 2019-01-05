'use strict'

export default botuser = ->
  Meteor.users.findOne {bot_wakeup: $exists: true}, {sort: bot_wakeup: -1}
