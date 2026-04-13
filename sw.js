// Filio Service Worker v2 — Optimized PWA caching
const CACHE_NAME = 'filio-v8-polished';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/firestore.js',
  '/js/utils.js',
  '/js/router.js',
  '/js/layout.js',
  '/js/app.js',
  '/js/security.js',
  '/js/security-auth.js',
  '/js/security-firestore.js',
];

// ── Install ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip: non-GET, Chrome extensions, Firebase/Google APIs
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname.includes('googleapis.com'))   return;
  if (url.hostname.includes('gstatic.com'))      return;
  if (url.hostname.includes('firebase'))         return;
  if (url.hostname.includes('firebaseio.com'))   return;
  if (url.hostname.includes('firebaseapp.com'))  return;
  if (url.hostname.includes('razorpay.com'))     return;
  if (url.hostname.includes('anthropic.com'))    return;
  if (url.hostname.includes('wati.io'))          return;
  if (url.hostname.includes('fonts.googleapis')) return;

  // HTML pages: network-first, fallback to cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS: stale-while-revalidate
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
