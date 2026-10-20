/* Arhiva — service worker, NETWORK-FIRST:
   uvek prvo mreza (najnovija verzija), kes samo kad nema interneta. */
const CACHE = 'arhiva-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // CDN i ostalo — bez mesanja
  e.respondWith((async () => {
    try {
      /* v192: cache 'no-cache' = uvek pitaj server (ETag); GitHub inače dozvoljava 10 min stare kopije (max-age=600) */
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
