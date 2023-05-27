export const registrationPromise = navigator.serviceWorker.register(
  Meteor._relativeToSiteRootUrl("sw.js")
);
