/* Menú de Família · capa de dades per a l'app (Supabase)
   Ofereix la mateixa interfície que el prototip (window.claude.use("db"|"user"|"assets"|"sample")),
   de manera que el codi de l'app és idèntic al de l'artefacte. */
(function () {
  const CFG = window.MF_CONFIG || {};
  const RECOVERY = /type=recovery/.test(location.hash + location.search);
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: Object.assign({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, window.MF_STORAGEKEY ? { storageKey: window.MF_STORAGEKEY } : {}) });
  window.MF_SB = sb;
  window.BLOBBASE = CFG.url.replace(/\/$/, "") + "/storage/v1/object/public/assets/";

  /* ---------- sessió i pantalla d'entrada ---------- */
  let session = null;
  const ADMIN = !!window.MF_STORAGEKEY;
  const LAST = (() => { try { return JSON.parse(localStorage.getItem("mf_lastfam") || "null") || {}; } catch (e) { return {}; } })();
  const INV = /[?&]codi=/.test(location.search);
  const ready = new Promise(async (resolve) => {
    const { data } = await sb.auth.getSession();
    session = data && data.session ? data.session : null;
    const go = () => { hideLogin(); resolve(); };
    sb.auth.onAuthStateChange((ev, s) => { if (s && !session) { session = s; try { localStorage.setItem("mf_lastmail", s.user.email || ""); } catch (e) {} go(); } });
    if (RECOVERY && session) return go();
    if (session) return go();
    showWelcome(go, ADMIN ? "login" : null);
  });
  let NOREL = false;
  sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_OUT" && !NOREL) location.reload(); if (ev === "PASSWORD_RECOVERY") showNewPass(); });
  if (RECOVERY) ready.then(() => showNewPass());

  /* ---------- nova contrasenya (des de l'enllaç del correu) ---------- */
  function showNewPass() {
    if (document.getElementById("mfnewp")) return;
    const d = document.createElement("div");
    d.id = "mflogin"; d.className = "mfnewp"; d.setAttribute("data-np", "1");
    d.innerHTML = `<div class="mfl" id="mfnewp"><h1>Nova contrasenya</h1><p>Escriu la contrasenya nova per al teu compte.</p>
      <form id="mfnpf"><input type="password" required minlength="6" placeholder="Contrasenya nova (mínim 6 caràcters)" autocomplete="new-password" aria-label="Contrasenya nova">
      <button class="primary" type="submit">Desa la contrasenya</button></form><p class="foot" id="mfnpm" role="status"></p></div>`;
    const go = () => { document.body.appendChild(d); d.querySelector("input").focus(); };
    if (document.body) go(); else addEventListener("DOMContentLoaded", go);
    d.querySelector("#mfnpf").addEventListener("submit", async (e) => {
      e.preventDefault(); const pw = d.querySelector("input").value; const m = d.querySelector("#mfnpm"); m.textContent = "Desant…";
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) { m.textContent = error.message; return; }
      m.textContent = "Contrasenya canviada ✓"; history.replaceState(null, "", location.pathname); setTimeout(() => d.remove(), 1200);
    });
  }

  const WCSS = `#mfwel{position:fixed;inset:0;z-index:200;background:#f3ead2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:max(24px,env(safe-area-inset-top)) 20px max(24px,env(safe-area-inset-bottom));font-family:"Source Sans 3",system-ui,-apple-system,sans-serif;color:#26231c;overflow:auto}
#mfwel .wlogo{width:96px;height:96px;border-radius:24px;box-shadow:0 6px 18px rgba(60,80,30,.25)}
#mfwel h1{font:700 32px "Fraunces",Georgia,serif;margin:0;text-align:center}
#mfwel .wtag{margin:-12px 0 0;color:#6b675d;font-size:16px;text-align:center}
#mfwel .wbtns{display:flex;flex-direction:column;gap:12px;width:min(380px,100%)}
#mfwel .wb{display:flex;align-items:center;gap:14px;width:100%;border:0;border-radius:18px;padding:16px 18px;text-align:left;cursor:pointer;font:inherit;box-shadow:0 3px 10px rgba(35,33,28,.12)}
#mfwel .wb .wi{font-size:28px;line-height:1;flex:none}
#mfwel .wb .wt{flex:1;display:flex;flex-direction:column;gap:2px}
#mfwel .wb b{font:700 19px "Fraunces",Georgia,serif}
#mfwel .wb small{font-size:13.5px;opacity:.85}
#mfwel .wfam{background:#6e8c3c;color:#fff}
#mfwel .wnew{background:#fff;color:#26231c;border:2px solid #6e8c3c}
#mfwel .wsh{position:fixed;inset:0;background:rgba(20,30,40,.45);display:flex;align-items:flex-end;justify-content:center;z-index:5}
#mfwel .wsh[hidden]{display:none}
#mfwel .wcard{background:#fff;border-radius:22px 22px 0 0;padding:22px 20px max(22px,env(safe-area-inset-bottom));width:min(480px,100%);display:flex;flex-direction:column;gap:10px;box-shadow:0 -6px 24px rgba(0,0,0,.2)}
@media (min-width:600px){#mfwel .wsh{align-items:center}#mfwel .wcard{border-radius:22px}}
#mfwel .wcard h2{font:700 22px "Fraunces",Georgia,serif;margin:0}
#mfwel .wcard p{margin:0;color:#6b675d;font-size:14.5px}
#mfwel .wcard form{display:flex;flex-direction:column;gap:10px;margin-top:4px}
#mfwel .wcard input{font-size:16px;font-family:inherit;padding:13px 14px;border:1px solid #d9d3c3;border-radius:12px;background:#fff;color:#26231c}
#mfwel .wcard .wp{font-size:16px;font-weight:700;font-family:inherit;padding:13px;border-radius:999px;border:0;background:#2f74b5;color:#fff;cursor:pointer}
#mfwel .wcard .wl{font-size:14.5px;font-weight:600;font-family:inherit;padding:8px;border:0;background:none;color:#2f74b5;cursor:pointer}
#mfwel .wmsg{min-height:1.2em;font-size:14px;color:#c2402e}`;

  function showWelcome(done, start) {
    if (!document.getElementById("mfwelcss")) { const st = document.createElement("style"); st.id = "mfwelcss"; st.textContent = WCSS; (document.head || document.documentElement).appendChild(st); }
    const d = document.createElement("div"); d.id = "mfwel"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    const famLbl = INV ? "T'han convidat a una família" : (LAST.nom ? (/^fam[ií]lia\b/i.test(LAST.nom) ? LAST.nom : "Família " + LAST.nom) : "Ja tinc compte");
    const famSub = INV ? "Entra o crea el teu compte i hi entraràs" : (session ? "Entra a l'app" : "Entra amb el teu correu");
    d.innerHTML = `<img class="wlogo" src="icon-192.png" alt=""><h1>Menú de Família</h1><p class="wtag">Què fem per dinar a casa?</p>
      <div class="wbtns">
        <button type="button" class="wb wfam" data-w="fam"><span class="wi">🏡</span><span class="wt"><b>${esc(famLbl)}</b><small>${esc(famSub)}</small></span></button>
        ${INV ? "" : `<button type="button" class="wb wnew" data-w="new"><span class="wi">🌱</span><span class="wt"><b>Sóc nou · Registra't</b><small>Crea el teu compte i la teva família</small></span></button>`}
      </div>
      <div class="wsh" hidden><div class="wcard"></div></div>`;
    const sh = d.querySelector(".wsh"), card = d.querySelector(".wcard");
    const mount = () => { document.body.appendChild(d); if (start) open(start); };
    if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
    function open(kind) {
      const reg = kind === "new";
      const mail = (() => { try { return localStorage.getItem("mf_lastmail") || ""; } catch (e) { return ""; } })();
      card.innerHTML = `<h2>${reg ? "Benvingut! Crea el teu compte" : "Entra al teu compte"}</h2>
        <p>${reg ? "Escriu el teu correu i tria una contrasenya. Després et guiarem pas a pas per crear la teva família." : "Escriu el correu i la contrasenya."}</p>
        <form autocomplete="on"><input type="email" name="email" required placeholder="el-teu@correu.cat" autocomplete="username" aria-label="Correu electrònic" value="${esc(reg ? "" : mail)}">
        <input type="password" name="password" required minlength="6" placeholder="${reg ? "Tria una contrasenya (mínim 6 caràcters)" : "Contrasenya"}" autocomplete="${reg ? "new-password" : "current-password"}" aria-label="Contrasenya">
        <button class="wp" type="submit">${reg ? "Crea el compte" : "Entra"}</button></form>
        <p class="wmsg" role="status"></p>
        ${reg ? `<button type="button" class="wl" data-w="login">Ja tinc compte: entra</button>` : `<button type="button" class="wl" data-w="forgot">He oblidat la contrasenya</button>${ADMIN ? "" : `<button type="button" class="wl" data-w="new">No tinc compte: registra't</button>`}`}`;
      sh.hidden = false; const i = card.querySelector(reg || !mail ? "input[type=email]" : "input[type=password]"); setTimeout(() => i && i.focus(), 50);
      const msg = (t) => { card.querySelector(".wmsg").textContent = t; };
      const vals = () => { const f = card.querySelector("form"); return { email: f.email.value.trim().toLowerCase(), password: f.password.value }; };
      card.querySelector("form").onsubmit = async (e) => {
        e.preventDefault(); const v = vals();
        if (reg) { msg("Creant el compte…"); const { data, error } = await sb.auth.signUp(v); if (error) return msg(tr(error.message)); if (!data.session) return msg("Compte creat, però cal confirmar el correu."); }
        else { msg("Entrant…"); const { error } = await sb.auth.signInWithPassword(v); if (error) return msg(tr(error.message)); }
        try { localStorage.setItem("mf_lastmail", v.email); } catch (_) {}
      };
      card.onclick = async (e) => {
        const b = e.target.closest("[data-w]"); if (!b) return;
        if (b.dataset.w === "forgot") { const v = vals(); if (!v.email) return msg("Escriu primer el teu correu."); msg("Enviant el correu…"); const { error } = await sb.auth.resetPasswordForEmail(v.email, { redirectTo: location.origin + location.pathname }); msg(error ? tr(error.message) : "T'hem enviat un correu per canviar la contrasenya. Mira també el correu brossa."); return; }
        open(b.dataset.w === "new" ? "new" : "login");
      };
    }
    d.addEventListener("click", (e) => {
      if (e.target === sh) { sh.hidden = true; return; }
      const b = e.target.closest(".wbtns [data-w]"); if (!b) return;
      if (b.dataset.w === "fam") { if (session) { d.remove(); done(); return; } open("login"); }
      else if (b.dataset.w === "new") { if (session) { NOREL = true; sb.auth.signOut({ scope: "local" }).catch(() => {}).finally(() => { setTimeout(() => { NOREL = false; }, 500); }); session = null; } open("new"); }
    });
  }
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tr = (m) => /invalid login/i.test(m) ? "Correu o contrasenya incorrectes." : /already registered/i.test(m) ? "Aquest correu ja té compte: entra amb «Ja tinc compte»." : /rate limit/i.test(m) ? "Massa intents seguits. Espera una estona." : m;
  function hideLogin() { const d = document.getElementById("mfwel"); if (d) d.remove(); const o = document.getElementById("mflogin"); if (o && !o.dataset.np) o.remove(); }

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

  /* ---------- lectura de documents (API de Claude via Supabase) ---------- */
  async function callAI(prompt, opts) {
    // Les imatges es pugen a Storage i la funció només rep els enllaços (cos petit)
    const blobs = ((opts && opts.images) || []).slice(0, 8);
    const ids = [];
    for (const bl of blobs) {
      const id = "tmp-" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("") + ".jpg";
      const { error: ue } = await sb.storage.from("assets").upload(id, bl, { contentType: "image/jpeg", upsert: false });
      if (ue) { const x = new Error("No s'ha pogut pujar la imatge: " + ue.message); x.code = "upstream_error"; throw x; }
      ids.push(id);
    }
    const urls = ids.map((id) => window.BLOBBASE + id);
    let data, error;
    try { ({ data, error } = await sb.functions.invoke("llegeix", { body: { prompt: String(prompt), urls, web: !!(opts && opts.web) } })); }
    finally { if (ids.length) sb.storage.from("assets").remove(ids).catch(() => {}); }
    let msg = data && data.error;
    if (error && !msg) { try { const j = await error.context.json(); msg = j && j.error; } catch (_) {} }
    if (error || !data || data.error) { const x = new Error(msg || (error && error.message) || "error"); x.code = "upstream_error"; throw x; }
    return data.text || "";
  }
  // el Capità dibuixa: redibuixa una foto o il·lustra una recepta amb l'estil de la casa → Blob
  const MF_DIBUIXA = async function (o) {
    const ids = [];
    try {
      for (const bl of (o.baseUrl ? [] : (o.fotos || [])).slice(0, 3)) {
        const id = "tmp-" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("") + ".jpg";
        const { error: ue } = await sb.storage.from("assets").upload(id, bl, { contentType: "image/jpeg", upsert: false });
        if (!ue) ids.push(id);
      }
      const { data, error } = await sb.functions.invoke("dibuixa", { body: { mode: o.baseUrl ? "edita" : ids.length ? "foto" : "inventa", urls: o.baseUrl ? [o.baseUrl] : ids.map((id) => window.BLOBBASE + id), n: o.n || "", ing: o.ing || "", steps: o.steps || "", nota: o.nota || "" } });
      let msg = data && data.error;
      if (error && !msg) { try { const j = await error.context.json(); msg = j && j.error; } catch (_) {} }
      if (error || !data || !data.image) throw new Error(msg || "No s'ha pogut dibuixar");
      const bin = atob(data.image), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Blob([u], { type: data.mime || "image/png" });
    } finally { if (ids.length) sb.storage.from("assets").remove(ids).catch(() => {}); }
  };
  // el Capità escolta: nota de veu → text (funciona també a l'iPhone)
  const MF_ESCOLTA = async function (blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const { data, error } = await sb.functions.invoke("dibuixa", { body: { mode: "escolta", audio: btoa(bin), mime: blob.type || "audio/mp4" } });
    let msg = data && data.error;
    if (error && !msg) { try { const j = await error.context.json(); msg = j && j.error; } catch (_) {} }
    if (error || !data || typeof data.text !== "string") throw new Error(msg || "No s'ha pogut escoltar");
    return data.text;
  };
  // només s'activen si el servei del Capità (funció «dibuixa» amb la clau de Gemini) està a punt
  window.MF_CAPITA_IMG = (async () => {
    await ready;
    try {
      const { data, error } = await sb.functions.invoke("dibuixa", { body: { mode: "ping" } });
      if (data && data.ok) { window.MF_DIBUIXA = MF_DIBUIXA; window.MF_ESCOLTA = MF_ESCOLTA; return true; }
      let why = data && data.ok === false ? "La funció «dibuixa» no troba el secret GEMINI_API_KEY" : "";
      if (!why && error) { why = error.message || "La funció «dibuixa» no respon"; try { const j = await error.context.json(); if (j && (j.error || j.message || j.msg)) why += " · " + (j.error || j.message || j.msg); } catch (_) { try { why += " · HTTP " + error.context.status; } catch (__) {} } }
      window.MF_CAPITA_WHY = why || "Resposta inesperada de la funció «dibuixa»";
    } catch (e) { window.MF_CAPITA_WHY = String((e && e.message) || e); }
    return false;
  })();
  // xat amb eines: l'app defineix les eines (execute) i aquí es fa el bucle tool_use → tool_result
  async function chatAI(input, opts) {
    const msgs = typeof input === "string" ? [{ role: "user", content: input }] : input.map((m) => ({ role: m.role, content: m.content }));
    const tools = (opts.tools || []).map((t) => ({ name: t.name, description: t.description || "", input_schema: t.inputSchema || { type: "object", properties: {} } }));
    for (let i = 0; i < 8; i++) {
      let data, error;
      ({ data, error } = await sb.functions.invoke("llegeix", { body: { messages: msgs, tools, ...(opts.system ? { system: opts.system } : {}) } }));
      let msg = data && data.error;
      if (error && !msg) { try { const j = await error.context.json(); msg = j && j.error; } catch (_) {} }
      if (error || !data || data.error) { const x = new Error(msg || (error && error.message) || "error"); x.code = "upstream_error"; throw x; }
      if (data.stop_reason !== "tool_use") return data.text || "";
      msgs.push({ role: "assistant", content: data.content });
      const res = [];
      for (const b of data.content || []) {
        if (b.type !== "tool_use") continue;
        const t = (opts.tools || []).find((x) => x.name === b.name);
        let out;
        try { out = t ? await t.execute(b.input || {}) : { error: "eina desconeguda" }; } catch (e) { out = { error: String(e && e.message || e) }; }
        res.push({ type: "tool_result", tool_use_id: b.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 60000) });
      }
      msgs.push({ role: "user", content: res });
    }
    return "No he pogut acabar la resposta. Torna-ho a provar.";
  }
  const sample = Object.assign(async (input, opts) => ({ text: opts && opts.tools ? await chatAI(input, opts) : await callAI(input, opts), truncated: false }), {
    limits: async () => ({ images: { maxCount: 8 } }),
    json: async (input, opts) => { const t = await callAI(input, opts); const m = t.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : t); },
  });

  window.claude = {
    use: async (name) => {
      await ready;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "assets") return assets;
      if (name === "sample") return sample;
      return null;
    },
  };
})();
