// Template: vite.config.ts (serviceWorker plugin) fills in the placeholders at build time.
// Every build changes this file, so browsers install the new worker and `activate` drops old caches.
const CACHE_NAME = 'zen-sudoku-__BUILD_ID__';
// Relative URLs resolve against this script's location, so the app works at / and under /sudoku-pwa/
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  // Hashed JS/CSS/worker files of this build, so the game works offline right after the first visit
  ...__BUILD_ASSETS__,
];
const INDEX_URL = new URL('./index.html', self.location).href;

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // Bypass the HTTP cache so a just-deployed index.html is not stored stale
  await cache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network first with cached index.html fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Never let a 404/5xx page replace the cached app shell
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, clone));
          }
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  // Static assets: Stale-While-Revalidate for instant offline work
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
