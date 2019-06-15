'use strict'

brain = new Mongo.Collection 'brain'

share.hubot.brain = (robot) ->

  robot.brain.setAutoSave false

  robot.brain.on 'save', Meteor.bindEnvironment (data) ->
    for _id, value of data._private
      try
        brain.upsert {_id, value}
      catch
        console.warn 'Couldn\'t save ', _id, value

  data = {_private: {}}
  brain.find({}).forEach (item) ->
    data._private[item._id] = item.value
  robot.brain.mergeData data

  robot.brain.emit 'connected'
  robot.brain.setAutoSave true
