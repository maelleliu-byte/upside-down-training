self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'Nouveau badge !', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Upside Down Training';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icon-192.png',
    badge:   data.badge || '/icon-192.png',
    vibrate: [200, 100, 200],
    silent:  false,
    data:    { url: data.url || '/' },
  };
  if (data.tag) { options.tag = data.tag; options.renotify = true; }

  // iPhone / iPad (Safari) : la notification système doit TOUJOURS être affichée,
  // sinon iOS finit par couper l'abonnement push.
  const ua = (self.navigator && self.navigator.userAgent) || '';
  const isAppleWebKit = /iPhone|iPad|iPod|Macintosh/.test(ua) && !/Chrome|CriOS|Android/.test(ua);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const visible = clientList.filter(c => c.visibilityState === 'visible');

      // App ouverte à l'écran → bandeau dans l'app (qui descend) + son
      visible.forEach(c => c.postMessage({
        type: 'udt-push', title, body: options.body, url: options.data.url, tag: data.tag || null,
      }));

      // Sur Android / ordi, si l'app est au premier plan, le bandeau de l'app suffit :
      // pas de doublon avec la notification système.
      const focused = visible.some(c => c.focused);
      if (focused && !isAppleWebKit) return;

      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const same = clientList.filter(c => c.url && c.url.startsWith(self.location.origin));
      // App déjà ouverte (même en arrière-plan) : on la ramène au premier plan
      // et on lui demande d'ouvrir le contenu de la notif (ex. le score liké).
      const client = same.find(c => c.focused) || same.find(c => c.visibilityState === 'visible') || same[0];
      if (client) {
        if (url !== '/') client.postMessage({ type: 'udt-open', url: target });
        if ('focus' in client) return client.focus().catch(() => {});
        return;
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
