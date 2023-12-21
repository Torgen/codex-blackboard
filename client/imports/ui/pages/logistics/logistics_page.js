import "./logistics_page.html";
import { EXPERT_MODE } from "/client/imports/settings.js";

const bundleLoaded = new ReactiveVar(false);

export function awaitBundleLoaded() {
  return new Promise((resolve) =>
    Tracker.autorun(function (computation) {
      if (!bundleLoaded.get()) {
        return;
      }
      resolve();
      computation.stop();
    })
  );
}

Template.logistics_page.onCreated(async function () {
  EXPERT_MODE.set(true);
  // The template we would set the top right to is loaded dynamically, so we
  // want to clear the current setting until the bundle loads. It will set the
  // top right panel to the correct template.
  // This matters mostly in development, but could come up if we update the app
  // during the hunt. Session preserves values across reloads and doesn't
  // trigger if the value doesn't change.
  Session.set("topRight", null);
  await import("/client/imports/ui/pages/logistics/logistics.js");
  bundleLoaded.set(true);
});

Template.logistics_page.helpers({
  bundleLoaded() {
    return bundleLoaded.get();
  },
});
