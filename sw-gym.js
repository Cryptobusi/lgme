// Gym beta shell. Scope is /gym only, so the main lgme service worker keeps the rest of the site.
const CACHE_NAME = 'lgme-gym-v42';
const SHELL = ['/gym', '/gym.html', '/gym/index.html', '/gym/covenant', '/gym/covenant.html', '/gym/intake-protocol', '/gym/intake-protocol.html', '/gym/health-data', '/gym/health-data.html', '/gym/breach-plan', '/gym/breach-plan.html', '/data/member-covenant.txt', '/data/intake-protocol.txt', '/gym-manifest.webmanifest', '/icons/gym-192.png', '/js/gym-app.mjs', '/js/device-card.mjs', '/js/device-capabilities.mjs', '/js/pwa-open.mjs', '/js/install-launch.mjs', '/js/health-page.mjs', '/js/personal-images.mjs', '/js/personal-images-ui.mjs', '/js/personal-images-apply.mjs', '/js/health-layout.mjs', '/js/health-presence.mjs', '/js/health-contact.mjs', '/js/equipment-referral.mjs', '/js/equipment-card.mjs', '/js/repair-follow.mjs', '/js/setup-fee.mjs', '/js/setup-fee-page.mjs', '/js/membership-pool.mjs', '/js/membership-pool-page.mjs', '/js/health-invite.mjs', '/js/gym-charts.mjs', '/js/health-plan.mjs', '/js/health-email.mjs', '/js/gym-progress.mjs', '/js/gym-feed.mjs', '/js/local-agents.mjs', '/js/covenant.mjs', '/js/covenant-page.mjs', '/js/intake.mjs', '/js/intake-view.mjs', '/js/intake-page.mjs', '/js/steward.mjs', '/js/health-safeguards.mjs', '/js/health-data-page.mjs', '/js/sponsor-report.mjs', '/images/photos/jogger-640.webp', '/images/photos/stretch-640.webp', '/images/photos/neighborhood-640.webp', '/images/photos/volunteers-640.webp', '/assets/img/repair-extraordinaire.webp'];

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
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match(request)).then((hit) => hit || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))));
});
