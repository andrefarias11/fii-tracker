// Service Worker Oficial do FII Tracker (Suporte a Web Push iOS 16.4+ / Android / Desktop)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe notificações Web Push mesmo com o app fechado e tela bloqueada (APNs / FCM)
self.addEventListener('push', (event) => {
  let data = {
    title: 'FII Tracker',
    body: 'Você tem uma nova atualização na sua carteira de FIIs.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'fii-tracker-push',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'fii-tracker-alert',
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Permite agendar ou disparar notificação via Service Worker (ex: Teste de Tela Bloqueada em 5s)
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'SHOW_NOTIFICATION') return;

  const delayMs = Number(msg.delayMs) || 0;
  const payload = msg.payload || {};

  const showPromise = new Promise((resolve) => {
    setTimeout(() => {
      self.registration
        .showNotification(payload.title || 'FII Tracker', {
          body: payload.body || 'Alerta da sua carteira de FIIs.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: payload.tag || 'fii-tracker-local',
          renotify: true,
          vibrate: [150, 80, 150],
          data: { url: payload.url || '/' },
        })
        .then(resolve)
        .catch(resolve);
    }, delayMs);
  });

  if (event.waitUntil) {
    event.waitUntil(showPromise);
  }
});

// Ao tocar na notificação na Tela de Bloqueio, abre ou foca o FII Tracker
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'NAVIGATE_FROM_PUSH', url: targetUrl });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

