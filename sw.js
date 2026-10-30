/* Copilot Feature-dle · service worker (offline play).
   The block between the BUILD markers is rewritten by tools\build.ps1 (new VERSION whenever any file changes). */

/* BUILD:START */
const VERSION = 'copilot-feature-dle-ec679b4f1e';
const CORE = ['./', 'assets/fonts/montserrat-latin-var.woff2', 'assets/fonts/noto-sans-latin-var.woff2', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon.svg', 'assets/icons/favicon-48.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png', 'assets/img/engage-squared-logo.png', 'assets/img/engage-squared-logo-white.png', 'assets/img/engage-squared-symbol.png', 'css/base.css', 'css/components.css', 'css/pages.css', 'css/views.css', 'data/features.js', 'data/features.json', 'index.html', 'js/00-core.js', 'js/05-config.js', 'js/10-icons.js', 'js/20-data.js', 'js/30-match.js', 'js/40-scoring.js', 'js/50-store.js', 'js/55-board.js', 'js/60-daily.js', 'js/70-game.js', 'js/80-share.js', 'js/85-fx.js', 'js/90-ui.js', 'js/91-view-home.js', 'js/92-play.js', 'js/93-result.js', 'js/94-view-modes.js', 'js/95-view-book.js', 'js/96-view-stats.js', 'js/97-view-board.js', 'js/98-view-about.js', 'js/98-view-packs.js', 'js/98-view-settings.js', 'js/99-app.js', 'manifest.webmanifest'];
/* BUILD:END */

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('copilot-feature-dle-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/api/leaderboard')) return; /* live event board: never cache */

  /* feature library: freshest copy when online, last known copy offline */
  if (url.pathname.endsWith('/data/features.json')) {
    event.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req))
    );
    return;
  }

  /* page loads: try the network, fall back to the cached shell */
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }

  /* everything else: cache first, refresh in the background */
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
