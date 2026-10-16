// lgme.app shell. HTML is fetched from the network first so a published change shows.
// The cache is the offline copy.
const CACHE_NAME = "lgme-v5";
const SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/spp",
  "/soverx",
  "/disclosures",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isHtml(request, url) {
  return request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(mp4|webm)$/i.test(url.pathname)) return;

  if (isHtml(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
          return response;
        })
        .catch(() => caches.match(url.pathname).then((hit) => hit || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(url.pathname).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
