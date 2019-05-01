self.addEventListener('notificationclick', function(event){
  const n = event.notification;
  n.close();
  clients.matchAll({type: 'window'}).then(function(clientList){
    if (clientList.length > 0) {
      const c = clientList[0];
      // Don't use navigate because it would reload the app.
      c.postMessage({action: 'navigate', url: n.data.url});
      c.focus();
    } else {
      clients.openWindow(n.data.url);
    }
  })
})
