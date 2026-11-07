// lgme.app shell. HTML is fetched from the network first so a published change shows.
const CACHE_NAME = "lgme-v48";
const NET_MS = 8000;
const SHELL = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/lgme-coin-192.webp",
  "/icons/lgme-coin-512.webp",
  "/lgme-coin",
  "/lgme-coin.html",
  "/icons/apple-touch-icon.png",
  "/p2p-exchange-sim",
  "/p2p-exchange-sim.html",
  "/js/p2p-exchange-sim.mjs",
  "/js/p2p-sim-guard.mjs",
  "/js/dc-reference.mjs",
  "/js/p2p-exchange-sim-ui.mjs",
  "/js/install-launch.mjs",
  "/js/solana-pay.mjs",
  "/js/p2p-resources.mjs",
  "/js/vendor/qrcode.js",
  "/js/vendor/jsQR.js",
  "/menu.css",
  "/legomiego-coin.jpg",
  "/data/dc-reference-values-v0.json",
  "/data/offerup-dc-v0.json",
  "/data/offerup-wanted-v0.json",
  "/data/thumbtack-wanted-v0.json",
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

function timedFetch(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL.map((url) => timedFetch(new Request(url), NET_MS).then((response) => {
      if (response && response.ok) return cache.put(url, response);
      return null;
    }).catch(() => null)))).then(() => self.skipWaiting())
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

  const fallback = () => {
    const path = url.pathname === "/p2p-exchange-sim" || url.pathname === "/p2p-exchange-sim.html"
      ? caches.match("/p2p-exchange-sim").then((hit) => hit || caches.match("/p2p-exchange-sim.html")).then((hit) => hit || caches.match("/"))
      : caches.match(url.pathname).then((hit) => hit || (isHtml(request, url) ? caches.match("/") : null));
    return path.then((hit) => hit || new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }));
  };

  event.respondWith(
    timedFetch(request, NET_MS)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy)).catch(() => {});
        }
        if (response && (response.ok || response.type === "opaqueredirect")) return response;
        return fallback();
      })
      .catch(() => fallback())
  );
});
