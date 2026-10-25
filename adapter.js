/* Menú de Família · capa de dades per a l'app (Supabase)
   Ofereix la mateixa interfície que el prototip (window.claude.use("db"|"user"|"assets"|"sample")),
   de manera que el codi de l'app és idèntic al de l'artefacte. */
(function () {
  const CFG = window.MF_CONFIG || {};
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.MF_SB = sb;
  window.BLOBBASE = CFG.url.replace(/\/$/, "") + "/storage/v1/object/public/assets/";

  /* ---------- sessió ---------- */
  let session = null;
  const ready = new Promise(async (resolve) => {
    const { data } = await sb.auth.getSession();
    if (data && data.session) { session = data.session; return resolve(); }
    showLogin();
    sb.auth.onAuthStateChange((ev, s) => { if (s && !session) { session = s; hideLogin(); resolve(); } });
  });
  sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_OUT") location.reload(); });

  function showLogin() {
    const d = document.createElement("div");
    d.id = "mflogin";
    d.innerHTML = `<div class="mfl"><h1>Menú de Família</h1><p>Entra amb el teu correu. T'hi enviarem un enllaç per accedir-hi, sense contrasenya.</p>
      <form id="mflf"><input type="email" required placeholder="el-teu@correu.cat" autocomplete="email" aria-label="Correu electrònic"><button class="primary" type="submit">Envia'm l'enllaç</button></form>
      <p class="foot" id="mflm" role="status"></p></div>`;
    const go = () => { document.body.appendChild(d); d.querySelector("input").focus(); };
    if (document.body) go(); else addEventListener("DOMContentLoaded", go);
    d.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = d.querySelector("input").value.trim(); const m = d.querySelector("#mflm");
      m.textContent = "Enviant…";
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      m.textContent = error ? "No s'ha pogut enviar: " + error.message : "Fet. Obre el correu i toca l'enllaç (mira també el correu brossa).";
    });
  }
  function hideLogin() { const d = document.getElementById("mflogin"); if (d) d.remove(); }

  /* ---------- documents ---------- */
  const subs = new Map();      // path -> Set(fn)
  const csubs = new Map();     // collection -> Set(fn)
  const cache = new Map();     // path -> data
  const snap = (path, data) => ({ id: path.split("/").pop(), exists: data !== undefined && data !== null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))), metadata: { hasPendingWrites: false, fromCache: false } });
  const isChild = (coll, p) => p.startsWith(coll + "/") && p.split("/").length === coll.split("/").length + 1;

  let channel = null;
  function ensureChannel() {
    if (channel) return;
    channel = sb.channel("docs-all").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (pl) => {
      const row = pl.new && pl.new.path ? pl.new : null; const p = row ? row.path : (pl.old && pl.old.path);
      if (!p) return;
      const data = pl.eventType === "DELETE" ? undefined : row.data;
      cache.set(p, data);
      (subs.get(p) || []).forEach((fn) => fn(snap(p, data)));
      for (const [c, set] of csubs) if (isChild(c, p)) refreshColl(c);
    }).subscribe();
  }
  async function refreshColl(c) {
    const { data, error } = await sb.from("docs").select("path,data").like("path", c + "/%");
    if (error) return;
    const docs = (data || []).filter((r) => isChild(c, r.path)).map((r) => snap(r.path, r.data));
    (csubs.get(c) || []).forEach((fn) => fn({ docs, size: docs.length, empty: !docs.length }));
  }
  const err = (e) => { const x = new Error(e && e.message || "error"); x.code = "upstream_error"; return x; };

  function doc(path) {
    return {
      async get() {
        const { data, error } = await sb.from("docs").select("data").eq("path", path).maybeSingle();
        if (error) throw err(error);
        return snap(path, data ? data.data : undefined);
      },
      async set(d) {
        const { error } = await sb.from("docs").upsert({ path, data: d, updated_at: new Date().toISOString() });
        if (error) throw err(error);
      },
      async update(patch) {
        const m = /^families\/([^/]+)$/.exec(path);
        const uid = session && session.user.id;
        if (m && patch && patch.membres && Object.keys(patch).length === 1 && patch.membres[uid] === true) {
          const { data, error } = await sb.rpc("join_family", { code: m[1] });
          if (error) throw err(error);
          if (!data) { const x = new Error("not found"); x.code = "invalid_argument"; throw x; }
          return;
        }
        const { error } = await sb.rpc("doc_merge", { p_path: path, p_patch: patch });
        if (error) throw err(error);
      },
      async delete() {
        const { error } = await sb.from("docs").delete().eq("path", path);
        if (error) throw err(error);
      },
      onSnapshot(fn, onErr) {
        ensureChannel();
        if (!subs.has(path)) subs.set(path, new Set());
        subs.get(path).add(fn);
        this.get().then(fn, (e) => onErr && onErr(e));
        return () => subs.get(path).delete(fn);
      },
    };
  }
  function collection(c) {
    return {
      doc: (id) => doc(c + "/" + id),
      onSnapshot(fn, onErr) {
        ensureChannel();
        if (!csubs.has(c)) csubs.set(c, new Set());
        csubs.get(c).add(fn);
        refreshColl(c).catch((e) => onErr && onErr(e));
        return () => csubs.get(c).delete(fn);
      },
    };
  }
  const db = { doc, collection };

  /* ---------- usuari ---------- */
  const user = {
    id: async () => session.user.id,
    me: async () => ({ id: session.user.id, name: (session.user.email || "").split("@")[0], email: session.user.email }),
    can: async () => true,
    canEdit: () => true,
    isOwner: () => false,
    profiles: async (ids) => Object.fromEntries((ids || []).map((i) => [i, { id: i, name: i === session.user.id ? (session.user.email || "").split("@")[0] : "" }])),
    signOut: () => sb.auth.signOut(),
  };

  /* ---------- fitxers ---------- */
  const assets = {
    async upload(blob, opts) {
      const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const type = (opts && opts.type) || blob.type || "application/octet-stream";
      const { error } = await sb.storage.from("assets").upload(id, blob, { contentType: type, upsert: false });
      if (error) { const x = new Error(error.message); x.code = /mime|type/i.test(error.message) ? "unsupported_type" : /size|large/i.test(error.message) ? "too_large" : "upstream_error"; throw x; }
      return { id, url: window.BLOBBASE + id, sizeBytes: blob.size, contentType: type };
    },
    async list() { return { assets: [], usage: {} }; },
    async delete(id) { await sb.storage.from("assets").remove([id]); },
  };

  window.claude = {
    use: async (name) => {
      await ready;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "assets") return assets;
      return null; // "sample" (lectura automàtica de documents): pendent per a una versió posterior
    },
  };
})();
