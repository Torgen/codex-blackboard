export const registrationPromise = navigator.serviceWorker?.register(
  Meteor._relativeToSiteRootUrl("sw.js")
) ?? Promise.reject("navigator.serviceWorker is absent");
