// Service Worker Oficial do FII Tracker (Suporte a Web Push iOS 16.4+ / Android / Desktop)

const SHELL_CACHE = 'fii-shell-5.1.0';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/', '/icon-192.png', '/manifest.webmanifest']))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin')
  ) {
    return;
  }
  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) || Response.error())
    );
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy))
              );
            }
            return response;
          })
      )
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('fii-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function sanitizeRelativeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/') || rawUrl.startsWith('//')) {
    return '/?tab=proventos';
  }
  return rawUrl;
}

// Recebe notificações Web Push mesmo com o app fechado e tela bloqueada (APNs / FCM)
self.addEventListener('push', (event) => {
  let data = {
    title: 'FII Tracker',
    body: 'Você tem uma atualização de proventos na sua carteira.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'fii-tracker-push',
    url: '/?tab=proventos',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const safeUrl = sanitizeRelativeUrl(data.url);

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'fii-tracker-alert',
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      url: safeUrl,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Permite disparar notificação local via Service Worker (ex: botão de teste)
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'SHOW_NOTIFICATION') return;

  const delayMs = Number(msg.delayMs) || 0;
  const payload = msg.payload || {};
  const safeUrl = sanitizeRelativeUrl(payload.url);

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
          data: { url: safeUrl },
        })
        .then(resolve)
        .catch(resolve);
    }, delayMs);
  });

  if (event.waitUntil) {
    event.waitUntil(showPromise);
  }
});

// Ao tocar na notificação, reutiliza uma janela aberta ou abre o FII Tracker no ativo/evento correspondente
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = sanitizeRelativeUrl(
    event.notification.data && event.notification.data.url
  );

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
