// Service worker: permite instalar la web como app y evita usar archivos viejos.
// Estrategia "primero la red": siempre trae la versión nueva; la copia guardada
// solo se usa si no hay conexión. Los datos de Neon y los mapas no se guardan.
const CACHE = "obras-oici-2026-11-20-2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== self.location.origin) return;
  ev.respondWith((async () => {
    try {
      const r = await fetch(ev.request, { cache: "no-cache" });
      if (r.ok) (await caches.open(CACHE)).put(ev.request, r.clone());
      return r;
    } catch (e) {
      const c = await caches.match(ev.request);
      if (c) return c;
      throw e;
    }
  })());
});
