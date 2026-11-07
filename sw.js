// lgme.app shell. HTML is fetched from the network first so a published change shows.
const CACHE_NAME = "lgme-v24";
const SHELL = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/p2p-exchange-sim",
  "/p2p-exchange-sim.html",
  "/js/p2p-exchange-sim.mjs",
  "/js/p2p-exchange-sim-ui.mjs",
  "/js/p2p-resources.mjs",
  "/js/vendor/qrcode.js",
  "/js/vendor/jsQR.js",
  "/menu.css",
  "/legomiego-coin.jpg",
  "/data/dc-reference-values-v0.json",
  "/docs/SPP_Overview.pptx",
  "/spp",
  "/soverx",
  "/disclosures",
  "/hederica",
  "/charter",
  "/bylaws",
  "/membership",
  "/exchange",
  "/technical",
  "/preparation",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))).then(() => self.skipWaiting())
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
        .catch(() => {
          if (url.pathname === "/p2p-exchange-sim" || url.pathname === "/p2p-exchange-sim.html") {
            return caches.match("/p2p-exchange-sim").then((hit) => hit || caches.match("/p2p-exchange-sim.html")).then((hit) => hit || caches.match("/"));
          }
          return caches.match(url.pathname).then((hit) => hit || caches.match("/"));
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
        }
        return response;
      })
      .catch(() => caches.match(url.pathname))
  );
});
