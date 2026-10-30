/* Menú de Família (nova) · service worker: l'app només s'actualitza des del botó «Busca actualitzacions» de Configuració */
const C = "mfn-app";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(["./", "./index.html"]).catch(() => {}))); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/nova/") || u.pathname.endsWith("/version.json") || u.pathname.endsWith("/sw.js")) return;
  const key = u.pathname.endsWith("/nova/") ? "./index.html" : e.request;
  e.respondWith(caches.open(C).then((c) => c.match(key, { ignoreSearch: u.pathname.endsWith(".html") || u.pathname.endsWith("/") }).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(key, r.clone()); return r; }))));
});
