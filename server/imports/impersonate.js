export async function impersonating(userId, f) {
  if (DDP._CurrentMethodInvocation.get()) {
    throw Meteor.Error(400, "already in call");
  }
  return await DDP._CurrentMethodInvocation.withValue({ userId }, f);
}

export const callAs = async (method, user, ...args) =>
  await impersonating(user, () => Meteor.callAsync(method, ...args));
