/**
 * SpeedLab Service Worker
 * ───────────────────────
 * Caches ONLY the static app shell (HTML/CSS/JS/icons) so the UI
 * loads instantly and works offline. Speed-test network requests
 * (Cloudflare endpoints, IP lookup) are NEVER cached — they must
 * always hit the live network, otherwise results would be fake.
 */

const CACHE_NAME = 'speedlab-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './speedtest.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER intercept speed-test or IP-lookup traffic — must always be live/real.
  const isLiveDataRequest =
    url.hostname.includes('speed.cloudflare.com') ||
    url.hostname.includes('ipapi.co') ||
    url.pathname.includes('/__down') ||
    url.pathname.includes('/__up') ||
    url.pathname.includes('cdn-cgi/trace');

  if (isLiveDataRequest) {
    return; // let the browser handle it normally, no SW involvement
  }

  // Only handle same-origin GET requests for the app shell
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
