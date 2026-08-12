/* FME-ME Portal v2.1.2 — Service Worker
   Network-first for HTML (so deployments appear instantly),
   stale-while-revalidate for JS/CSS, network-first for data JSON. */

const CACHE_VERSION = 'fme-v2.1.2';
const ASSETS = [
  './',
  './index.html',
  './training.html',
  './templates.html',
  './form.html',
  './404.html',
  './css/style.css',
  './js/common.js',
  './js/app.js',
  './js/overview.js',
  './js/training.js',
  './js/templates.js',
  './js/form-engine.js',
  './js/draft-manager.js',
  './js/xlsx-export.js',
  './js/submit-manager.js',
  './lib/xlsx.full.min.js',
  './icons/icon.svg',
  './favicon.svg',
  './manifest.json',
  './data/stats.json',
  './data/domains.json',
  './data/courses.json',
  './data/templates.json',
  './data/i18n.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Skip cross-origin
  if (url.origin !== location.origin) return;

  // Network-first for data JSON (always get fresh data if online)
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // Network-first for HTML pages (so new deployments appear on next refresh)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for JS/CSS/icons/etc.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
