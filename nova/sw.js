/* Menú de Família (nova) · service worker: l'app només s'actualitza des del botó «Busca actualitzacions» de Configuració */
const C = "mfn-app-6";
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

/* avisos al mòbil (web push) */
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Menú de Família", { body: d.body || "", icon: "img/rebost.png", badge: "img/rebost.png", tag: d.tag || "rebost", data: { url: d.url || "./?av=1" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./?av=1", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) { if (c.url.includes("/nova/")) { c.postMessage({ av: 1 }); return c.focus(); } } return self.clients.openWindow(url); }));
});
