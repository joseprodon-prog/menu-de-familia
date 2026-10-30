/* Menú de Família (nova) · service worker: l'app només s'actualitza des del botó «Busca actualitzacions» de Configuració */
const C = "mfn-app-3";
const clean = (r) => r.redirected ? r.blob().then((b) => new Response(b, { status: 200, headers: r.headers })) : Promise.resolve(r);
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => fetch("./", { cache: "no-store" }).then(clean).then((r) => r.ok && c.put("./", r))).catch(() => {})); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("mfn") && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/nova/") || u.pathname.endsWith("/version.json") || u.pathname.endsWith("/sw.js")) return;
  const page = e.request.mode === "navigate" || u.pathname === "/nova/" || u.pathname.endsWith("/index.html");
  const key = page ? "./" : e.request;
  e.respondWith(caches.open(C).then((c) => c.match(key, { ignoreSearch: page }).then((hit) => {
    if (hit && !hit.redirected) return hit;
    return fetch(page ? "./" : e.request).then(clean).then((r) => { if (r.ok) c.put(key, r.clone()); return r; });
  })));
});
