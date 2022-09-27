export function impersonating(userId, f) {
  if (DDP._CurrentMethodInvocation.get()) {
    throw Meteor.Error(400, "already in call");
  }
  return DDP._CurrentMethodInvocation.withValue({ userId }, () => f());
}

export const callAs = (method, user, ...args) =>
  impersonating(user, () => Meteor.call(method, ...args));
