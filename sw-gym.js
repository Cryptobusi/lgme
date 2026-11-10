// Gym beta shell. Scope is /gym only, so the main lgme service worker keeps the rest of the site.
const CACHE_NAME = 'lgme-gym-v9';
const SHELL = ['/gym', '/gym.html', '/gym/covenant', '/gym-covenant.html', '/data/member-covenant.txt', '/gym-manifest.webmanifest', '/icons/gym-192.png', '/js/gym-app.mjs', '/js/gym-progress.mjs', '/js/gym-feed.mjs', '/js/local-agents.mjs', '/js/covenant.mjs', '/js/covenant-page.mjs'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL.map((url) => fetch(url).then((response) => {
    if (response && response.ok) return cache.put(url, response);
    return null;
  }).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('lgme-gym-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    if (clients[0]) return clients[0].focus();
    return self.clients.openWindow('/gym');
  }));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'agent-reminder') return;
  event.waitUntil(self.registration.showNotification(event.data.title || 'Reminder', {
    body: event.data.body || '',
    tag: event.data.id || 'lgme-agent'
  }));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => {
    if (response && response.ok && url.pathname === '/gym') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('/gym', copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(url.pathname === '/gym' ? '/gym' : request).then((hit) => hit || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))));
});
