self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: '🏅 Nouveau badge !', body: event.data ? event.data.text() : '' };
  }

  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icon-192.png',
    badge:   data.badge || '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Voir mon profil' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🏅 Badge débloqué !', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
