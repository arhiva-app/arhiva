/* Arhiva — service worker, NETWORK-FIRST:
   uvek prvo mreza (najnovija verzija), kes samo kad nema interneta. */
const CACHE = 'arhiva-v1';
/* v252 Podeli → Arhiva (Web Share Target, developer.chrome.com): fajlovi čekaju u ovom kešu dok ih Arhiva ne sačuva */
const PRIMLJENO = 'arhiva-primljeno';

async function primi(req) {
  try {
    const fd = await req.formData();
    const c = await caches.open(PRIMLJENO);
    let k = 0;
    for (const f of fd.getAll('fajlovi')) {
      if (!f || typeof f === 'string' || !f.size) continue;
      await c.put(new Request(new URL('__primljeno/' + Date.now() + '-' + (k++), self.registration.scope).href),
        new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Ime': encodeURIComponent(f.name || '') } }));
    }
  } catch (err) { /* Arhiva se ipak otvori */ }
  return Response.redirect(new URL('./index.html', self.registration.scope).href, 303);
}

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== PRIMLJENO).map(k => caches.delete(k)));
    /* v302 (K16): do v301 svaka adresa sa ?v=N čuvala se posebno (ceo index.html po otvorenom linku) — jednom se brišu */
    try {
      const c = await caches.open(CACHE);
      for (const r of await c.keys()) { if (new URL(r.url).search) await c.delete(r); }
    } catch (err) { /* nije presudno */ }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/primi')) { e.respondWith(primi(req)); return; }
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;      // CDN i ostalo — bez mesanja
  e.respondWith((async () => {
    try {
      /* v192: cache 'no-cache' = uvek pitaj server (ETag); GitHub inače dozvoljava 10 min stare kopije (max-age=600) */
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) {
        const copy = res.clone();
        /* v302 (K16): ključ bez ?v=… — jedan primerak po fajlu (keš se podudara i sa upitom, MDN: ignoreSearch je podrazumevano false) */
        caches.open(CACHE).then(c => c.put(url.origin + url.pathname, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
