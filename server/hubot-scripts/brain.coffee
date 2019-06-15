'use strict'

brain = new Mongo.Collection 'brain'

share.hubot.brain = (robot) ->

  robot.brain.setAutoSave false

  robot.brain.on 'save', Meteor.bindEnvironment (data) ->
    for _id, value of data
      continue if _id is 'users'
      try
        brain.upsert {_id}, $set: {value}
      catch err
        console.warn 'Couldn\'t save ', _id, value, err

  handle = Meteor.users.find({}).observe
    added: (user) ->
      robot.brain.userForId user._id, {name: user.real_name ? user.nickname ? user._id, robot}
    changed: (newUser, oldUser) ->
      u = robot.brain.data.users[newUser._id]
      return unless u?
      u.name = newUser.real_name ? newUser.nickname ? newUser._id
    removed: (user) ->
      delete robot.brain.data.users[user._id]

  robot.brain.on 'close', Meteor.bindEnvironment -> handle.stop()

  data =  _private: {}
  brain.find({}).forEach (item) ->
    data[item._id] = item.value
  robot.brain.mergeData data

  robot.brain.emit 'connected'
  robot.brain.setAutoSave true
