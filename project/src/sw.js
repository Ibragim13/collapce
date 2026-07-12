/* Beacon service worker — precached app shell (via vite-plugin-pwa injectManifest)
   + a hand-written runtime cache for map tiles so visited map areas work fully offline. */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const TILES = 'beacon-tiles-v1';
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (!/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|tiles\./.test(url.hostname)) return;

  e.respondWith(caches.open(TILES).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch (err) { return hit || Response.error(); }
  }));
});
