// BETWISE — service worker minimal : reçoit les partages Android (captures, vidéos) sans passer par le serveur,
// pour lever la limite de taille des requêtes. Aucune mise en cache des pages.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/import/share") return;
  event.respondWith((async () => {
    const form = await event.request.formData();
    const files = form.getAll("image").filter((f) => f && typeof f === "object" && f.size > 0);
    if (!files.length) {
      const q = new URLSearchParams({ text: String(form.get("text") || ""), url: String(form.get("url") || ""), title: String(form.get("title") || "") });
      return Response.redirect(`/import?${q}`, 303);
    }
    const cache = await caches.open("betwise-share");
    for (const k of await cache.keys()) await cache.delete(k);
    let i = 0;
    for (const f of files.slice(0, 7)) {
      await cache.put(`/__shared/${String(i++).padStart(2, "0")}`, new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "partage") } }));
    }
    return Response.redirect("/import?shared=1", 303);
  })());
});
