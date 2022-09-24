// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { scripts } from '/server/imports/botutil.coffee';

export var brain = new Mongo.Collection('brain');

export default scripts.brain = function(robot) {

  robot.brain.setAutoSave(false);

  robot.brain.on('save', Meteor.bindEnvironment(data => (() => {
    const result = [];
    for (let _id in data) {
      const value = data[_id];
      if (_id === 'users') { continue; }
      try {
        result.push(brain.upsert({_id}, {$set: {value}}));
      } catch (err) {
        result.push(console.warn('Couldn\'t save ', _id, value, err));
      }
    }
    return result;
  })())
  );

  const handle = Meteor.users.find({}).observe({
    added(user) {
      return robot.brain.userForId(user._id, {name: user.real_name ?? user.nickname ?? user._id, robot});
    },
    changed(newUser, oldUser) {
      const u = robot.brain.data.users[newUser._id];
      if (u == null) { return; }
      return u.name = newUser.real_name ?? newUser.nickname ?? newUser._id;
    },
    removed(user) {
      return delete robot.brain.data.users[user._id];
    }});

  robot.brain.on('close', Meteor.bindEnvironment(() => handle.stop()));

  const data =  {_private: {}};
  brain.find({}).forEach(item => data[item._id] = item.value);
  robot.brain.mergeData(data);

  robot.brain.emit('connected');
  return robot.brain.setAutoSave(true);
};
