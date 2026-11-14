// Lightweight Service Worker for PWA Desktop/Mobile Installability
// Strictly bypasses caching for Supabase API requests so data is always 100% live from Cloud

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache Supabase REST/Storage/Auth calls or non-GET requests
  if (
    req.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    return;
  }

  // Network-first strategy without hard-caching dynamic data
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
