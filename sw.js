// lgme.app shell. HTML is fetched from the network first so a published change shows.
const CACHE_NAME = "lgme-v163";
const NET_MS = 8000;
const SHELL = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/lgme-coin-192.webp",
  "/icons/lgme-coin-512.webp",
  "/js/personal-images.mjs",
  "/js/personal-images-ui.mjs",
  "/js/personal-images-apply.mjs",
  "/credits",
  "/credits.html",
  "/testnet-review",
  "/testnet-review.html",
  "/js/testnet-review.mjs",
  "/images/photos/jogger-640.webp",
  "/images/photos/jogger-1200.webp",
  "/images/photos/stretch-640.webp",
  "/images/photos/stretch-1200.webp",
  "/images/photos/neighborhood-640.webp",
  "/images/photos/neighborhood-1200.webp",
  "/images/photos/shop-street-640.webp",
  "/images/photos/shop-street-1200.webp",
  "/images/photos/volunteers-640.webp",
  "/images/photos/volunteers-1200.webp",
  "/images/photos/dumbbells-640.webp",
  "/images/photos/dumbbells-1200.webp",
  "/images/photos/market-640.avif",
  "/images/photos/market-1200.avif",
  "/images/photos/market-640.webp",
  "/images/photos/market-1200.webp",
  "/images/photos/market-640.jpg",
  "/images/photos/market-1200.jpg",
  "/assets/img/repair-extraordinaire.webp",
  "/lgme-coin",
  "/lgme-coin.html",
  "/js/lgme-coin-page.js",
  "/js/payment-notice.mjs",
  "/grants",
  "/grants.html",
  "/icons/apple-touch-icon.png",
  "/exchange",
  "/exchange.html",
  "/js/exchange-listing.mjs",
  "/js/exchange-test-page.mjs",
  "/js/exchange-overview.mjs",
  "/js/trade-types.mjs",
  "/js/health-examples.mjs",
  "/js/health-dashboard.mjs",
  "/js/exchange-overview-ui.mjs",
  "/js/setup-fee.mjs",
  "/js/setup-fee-page.mjs",
  "/js/membership-pool.mjs",
  "/js/membership-pool-page.mjs",
  "/js/health-invite.mjs",
  "/join",
  "/join.html",
  "/js/join-page.js",
  "/js/p2p-exchange-sim.mjs",
  "/js/p2p-sim-guard.mjs",
  "/js/dc-reference.mjs",
  "/js/p2p-exchange-sim-ui.mjs",
  "/js/install-launch.mjs",
  "/js/solana-pay.mjs",
  "/js/lgme-price.mjs",
  "/js/clearing.mjs",
  "/js/sourcing.mjs",
  "/js/p2p-resources.mjs",
  "/js/vendor/qrcode.js",
  "/js/vendor/jsQR.js",
  "/menu.css",
  "/legomiego-coin.jpg",
  "/data/dc-reference-values-v0.json",
  "/data/offerup-dc-v0.json",
  "/data/offerup-wanted-v0.json",
  "/data/thumbtack-wanted-v0.json",
  "/data/sourcing-daily.json",
  "/data/payment-methods.json",
  "/docs/SPP_Overview.pptx",
  "/spp",
  "/soverx",
  "/disclosures",
  "/hederica",
  "/charter",
  "/bylaws",
  "/membership",
  "/mutual-credit",
  "/how-it-works",
  "/marketing",
  "/marketing.html",
  "/plain-english",
  "/plain-english.html",
  "/campus",
  "/campus.html",
  "/health-club",
  "/health-club.html",
  "/gym",
  "/gym.html",
  "/gym/covenant",
  "/gym/covenant.html",
  "/gym/intake-protocol",
  "/gym/intake-protocol.html",
  "/gym/health-data",
  "/gym/health-data.html",
  "/gym/breach-plan",
  "/gym/breach-plan.html",
  "/js/health-safeguards.mjs",
  "/js/health-data-page.mjs",
  "/js/sponsor-report.mjs",
  "/data/intake-protocol.txt",
  "/js/intake.mjs",
  "/js/steward.mjs",
  "/js/intake-view.mjs",
  "/js/intake-page.mjs",
  "/gym/index.html",
  "/gym-covenant.html",
  "/data/member-covenant.txt",
  "/js/covenant.mjs",
  "/js/covenant-page.mjs",
  "/gym-manifest.webmanifest",
  "/sw-gym.js",
  "/icons/gym-192.png",
  "/js/gym-app.mjs",
  "/js/dispute.mjs",
  "/disclaimer",
  "/disclaimer.html",
  "/data/topic-0.0.11399829-message-1.json",
  "/helper",
  "/helper.html",
  "/js/helper-wizard.mjs",
  "/js/helper-page.mjs",
  "/js/helper-store.mjs",
  "/milestones",
  "/milestones.html",
  "/preview-campus",
  "/preview-neighbor",
  "/preview-hosts",
  "/preview-circles",
  "/preview-stories",
  "/preview-exchange",
  "/preview.css",
  "/js/preview-note.js",
  "/neighbors",
  "/hosts",
  "/circles",
  "/stories",
  "/js/pairing.mjs",
  "/js/pairing-page.mjs",
  "/ai-help",
  "/ai-help.html",
  "/js/ai-help.mjs",
  "/js/ai-help-page.mjs",
  "/js/equipment-referral.mjs",
  "/js/equipment-card.mjs",
  "/js/repair-follow.mjs",
  "/js/gym-progress.mjs",
  "/wisdom",
  "/wisdom.html",
  "/js/wisdom.mjs",
  "/js/wisdom-page.mjs",
  "/data/wisdom-excerpts.json",
  "/js/plain-view.mjs",
  "/js/home-onboarding.mjs",
  "/js/category-help.mjs",
  "/js/one-tap.mjs",
  "/js/demo-onboard.mjs",
  "/js/demo-page.mjs",
  "/js/site-nav.js",
  "/js/sw-update.js",
  "/js/local-ai-panel.mjs",
  "/js/ai-setup.mjs",
  "/js/ai-setup-page.mjs",
  "/js/dev-board.mjs",
  "/js/reset-epoch.mjs",
  "/ai-setup",
  "/ai-setup.html",
  "/site-nav.css",
  "/js/stable-screen.js",
  "/404.html",
  "/develop",
  "/develop.html",
  "/js/develop-page.mjs",
  "/js/develop-want.mjs",
  "/owner",
  "/owner.html",
  "/js/owner-inbox.mjs",
  "/js/join-explain.mjs",
  "/js/device-capabilities.mjs",
  "/js/home-entry.js",
  "/js/view-only.js",
  "/js/health-tile-photo.mjs",
  "/js/gym-feed.mjs",
  "/js/campus-page.mjs",
  "/js/subfloor.mjs",
  "/js/passkey-unlock.mjs",
  "/js/email-check.mjs",
  "/js/health-email.mjs",
  "/js/health-plan.mjs",
  "/js/health-layout.mjs",
  "/js/health-page.mjs",
  "/js/health-presence.mjs",
  "/js/health-contact.mjs",
  "/images/health-plan-easy.png",
  "/images/health-plan-engaging.png",
  "/images/health-plan-ultimate.png",
  "/js/hedera-anchor.mjs",
  "/js/exercise-record.mjs",
  "/js/exercise-sensors.mjs",
  "/js/shared-listings.mjs",
  "/js/email-check-core.mjs",
  "/good-deeds",
  "/good-deeds.html",
  "/examine",
  "/examine.html",
  "/help",
  "/help.html",
  "/glossary",
  "/glossary.html",
  "/data/subfloor.json",
  "/data/campus-pilot.json",
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("lgme-v") && key !== CACHE_NAME).map((key) => caches.delete(key))))
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
  const moved = {
    "/p2p-exchange-sim": "/exchange",
    "/p2p-exchange-sim.html": "/exchange",
    "/mutual-credit-simulator": "/mutual-credit",
    "/mutual-credit-simulator.html": "/mutual-credit",
    "/simulation-explainer": "/how-it-works",
    "/simulation-explainer.html": "/how-it-works",
    "/ididit": "/exchange",
    "/ididit.html": "/exchange"
  };
  if (moved[url.pathname]) {
    event.respondWith(Response.redirect(moved[url.pathname], 301));
    return;
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return;

  const fallback = () => {
    const path = url.pathname === "/exchange" || url.pathname === "/exchange.html"
      ? caches.match("/exchange").then((hit) => hit || caches.match("/exchange.html")).then((hit) => hit || caches.match("/"))
      : caches.match(url.pathname).then((hit) => hit || (isHtml(request, url) ? caches.match("/") : null));
    return path.then((hit) => hit || new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }));
  };

  const network = isHtml(request, url)
    ? fetch(new Request(request, { cache: 'no-cache' }))
    : timedFetch(request, NET_MS);
  event.respondWith(
    network
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy)).catch(() => {});
        }
        if (response) return response;
        return fallback();
      })
      .catch(() => fallback())
  );
});
