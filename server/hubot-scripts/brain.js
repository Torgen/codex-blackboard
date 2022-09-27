import { scripts } from "/server/imports/botutil.js";

export var brain = new Mongo.Collection("brain");

export default scripts.brain = function (robot) {
  robot.brain.setAutoSave(false);

  robot.brain.on(
    "save",
    Meteor.bindEnvironment(function (data) {
      for (let _id in data) {
        const value = data[_id];
        if (_id === "users") {
          continue;
        }
        try {
          brain.upsert({ _id }, { $set: { value } });
        } catch (err) {
          console.warn("Couldn't save ", _id, value, err);
        }
      }
    })
  );

  const handle = Meteor.users.find({}).observe({
    added(user) {
      robot.brain.userForId(user._id, {
        name: user.real_name ?? user.nickname ?? user._id,
        robot,
      });
    },
    changed(newUser, oldUser) {
      const u = robot.brain.data.users[newUser._id];
      if (u == null) {
        return;
      }
      u.name = newUser.real_name ?? newUser.nickname ?? newUser._id;
    },
    removed(user) {
      delete robot.brain.data.users[user._id];
    },
  });

  robot.brain.on(
    "close",
    Meteor.bindEnvironment(() => handle.stop())
  );

  const data = { _private: {} };
  brain.find({}).forEach((item) => (data[item._id] = item.value));
  robot.brain.mergeData(data);

  robot.brain.emit("connected");
  robot.brain.setAutoSave(true);
};
