/// <reference lib="webworker" />
// Service Worker custom para DAGMA 360.
// - Pre-cache del app shell via Workbox (injectManifest)
// - Cache runtime para tiles/imagenes estaticas
// - Listener `sync` para flush de la cola offline (Chrome Android)
// - Listener `message` para sincronizacion manual desde la app
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

cleanupOutdatedCaches();
// __WB_MANIFEST se inyecta en build time por vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST);

// Tiles de mapa: cache-first con caducidad implicita (LRU del navegador)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/cartografia_base/') ||
    /\.(?:png|jpg|jpeg|svg|webp)$/i.test(url.pathname),
  new CacheFirst({ cacheName: 'dagma-assets' })
);

// API GET (catalogos, listados) → network-first con fallback a cache
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api-capturas/')),
  new NetworkFirst({
    cacheName: 'dagma-api-get',
    networkTimeoutSeconds: 8,
  })
);

// Toma control inmediato cuando hay nueva version
self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Sincronizacion ──
// El SW por si solo no puede acceder a IndexedDB con el wrapper `idb`
// (no aceptaria el bundle aqui), asi que delegamos al cliente: cuando se
// dispare `sync` o llegue un mensaje, despertamos a las ventanas abiertas.

async function notifyClientsToFlush(reason: string) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'DAGMA_FLUSH_QUEUE', reason });
  }
}

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'dagma-sync') {
    event.waitUntil(notifyClientsToFlush('sync-event'));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
  if (data.type === 'REQUEST_FLUSH') {
    event.waitUntil(notifyClientsToFlush('manual'));
  }
});

export {};
