self.addEventListener("notificationclick", function (event) {
  const n = event.notification;
  n.close();
  if (!n || !n.data || !n.data.url) {
    return;
  }
  clients.matchAll({ type: "window" }).then(function (clientList) {
    if (clientList.length > 0) {
      const c = clientList[0];
      // Don't use navigate because it would reload the app.
      c.postMessage({ action: "navigate", url: n.data.url });
      c.focus();
    } else {
      clients.openWindow(n.data.url);
    }
  });
});
let lastSolved = null;
let lastPartial = null;
self.addEventListener("message", function (event) {
  if (event.data.type === "puzzlesolved" && event.data.key !== lastSolved) {
    lastSolved = event.data.key;
    event.source.postMessage({ action: "playnewanswersound" });
  }
  if (event.data.type === "partialsolved" && event.data.key !== lastPartial) {
    lastPartial = event.data.key;
    event.source.postMessage({ action: "playpartialanswersound" });
  }
});
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
