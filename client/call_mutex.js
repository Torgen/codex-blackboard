const anyCalls = new ReactiveVar(false);

Meteor.noMethodsInFlight = Promise.resolve();
Meteor.callInFlight = function () { return anyCalls.get(); }
Meteor.serializeCall = function (...args) {
  Tracker.nonreactive(function () {
    if (anyCalls.get()) {
      throw new Error("Call in flight");
    }
  });
  anyCalls.set(true);
  const resP = Meteor.callAsync(...args);
  Meteor.noMethodsInFlight = Promise.allSettled([resP]).then(function () { anyCalls.set(false);});
  return resP;
}
