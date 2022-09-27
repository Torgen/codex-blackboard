export const DO_BATCH_PROCESSING = !(
  Meteor.settings.disableBatch ?? process.env.DISABLE_BATCH_PROCESSING
);
