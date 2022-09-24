/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export var impersonating = function(userId, f) {
  if (DDP._CurrentMethodInvocation.get()) { throw Meteor.Error(400, 'already in call'); }
  return DDP._CurrentMethodInvocation.withValue({userId}, () => f());
};

export var callAs = (method, user, ...args) => impersonating(user, () => Meteor.call(method, ...args));
