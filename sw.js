// La web se mudó a https://oicirepo.github.io/Seguimiento/: este service worker borra la copia guardada, se da de baja y manda a la dirección nueva.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("https://oicirepo.github.io/Seguimiento/");
})()));
