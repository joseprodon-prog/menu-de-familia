// Menú de Família · informe setmanal de talent (_TASCA_Registre_Us_i_Talent)
// Llegeix mf_events (darrers 7 dies) i la bústia de suggeriments (docs feedback/<uid>).
// Retorna un informe en text (Markdown) o JSON (?format=json): rànquing de talent (idees, encert, iniciativa)
// i, a part i sense posició, el bloc d'ús.
// Puntuació d'idees: Gemini (utilitat, originalitat, viabilitat, 1-5). Es desa a docs informe/idees i no es repuntua.
// Correccions d'en Josep: docs informe/notes {idees:{"<uid>|<sid>": nota 1-5}} (preval sobre la de Gemini).
// Secrets: INFORME_KEY, GEMINI_API_KEY (ja hi és). Desplega amb --no-verify-jwt.

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });
const txt = (b: string) => new Response(b, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

const ENCERT_BO: Record<string, number> = { menu_crea: 2, plat_ok: 1, compra_ok: 0.5, rebost_afegeix: 1, tiquet_desat: 2 };
const ENCERT_MAL: Record<string, number> = { elimina: 1, compra_desfa: 0.5 };
const INICIATIVA: Record<string, number> = { compra_conj_nova: 3, compra_conj_uneix: 1, punt_crea: 2, convida: 2, foto_article: 1, xat: 0.3 };

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const k = req.headers.get("x-informe-key") || u.searchParams.get("k");
  if (!k || k !== Deno.env.get("INFORME_KEY")) return json({ error: "no" }, 401);
  const su = Deno.env.get("SUPABASE_URL")!, sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const H = { apikey: sr, Authorization: `Bearer ${sr}`, "Content-Type": "application/json" };
  const rest = async (q: string) => { const r = await fetch(`${su}/rest/v1/${q}`, { headers: H }); return r.ok ? await r.json() : []; };
  const merge = (p_path: string, p_patch: unknown) => fetch(`${su}/rest/v1/rpc/doc_merge`, { method: "POST", headers: H, body: JSON.stringify({ p_path, p_patch }) });

  const ara = Date.now(), d7 = new Date(ara - 7 * 864e5).toISOString(), d14 = new Date(ara - 14 * 864e5).toISOString();
  const ev: any[] = await rest(`mf_events?select=usuari,tipus,dur_ms,passos,meta,at&at=gte.${d14}&order=at.asc&limit=50000`);
  const fb: any[] = await rest(`docs?select=path,data&path=like.feedback/*`);
  const notesDoc = (await rest(`docs?select=data&path=eq.informe/notes`))[0];
  const ideesDoc = (await rest(`docs?select=data&path=eq.informe/idees`))[0];
  const NOTES = (notesDoc && notesDoc.data && notesDoc.data.idees) || {};
  const PUNT: Record<string, any> = (ideesDoc && ideesDoc.data && ideesDoc.data.p) || {};

  // Noms: bústia (nom, fam) i, si no, el correu del compte
  const NOM: Record<string, string> = {};
  try {
    const r = await fetch(`${su}/auth/v1/admin/users?per_page=1000`, { headers: H });
    const j = await r.json();
    for (const x of (j.users || [])) NOM[x.id] = (x.user_metadata && (x.user_metadata.nom || x.user_metadata.name)) || x.email || x.id.slice(0, 8);
  } catch (_) { /* res */ }
  for (const d of fb) { const uid = String(d.path).split("/").pop()!; const n = d.data && d.data.nom; if (n) NOM[uid] = n + (d.data.fam ? ` (${d.data.fam})` : ""); }

  // Idees de la setmana (missatges de l'usuari, no respostes de l'Hortolà)
  const idees: { key: string; uid: string; t: string }[] = [];
  for (const d of fb) {
    const uid = String(d.path).split("/").pop()!;
    for (const [sid, it] of Object.entries((d.data && d.data.items) || {}) as [string, any][]) {
      if (!it || it.de === "h" || !it.t) continue;
      const at = typeof it.at === "number" ? new Date(it.at).toISOString() : String(it.at || "");
      if (at >= d7) idees.push({ key: `${uid}|${sid}`, uid, t: String(it.t).slice(0, 1200) });
    }
  }
  const noves = idees.filter((x) => !PUNT[x.key]);
  const gk = Deno.env.get("GEMINI_API_KEY");
  if (noves.length && gk) {
    const models = (Deno.env.get("GEMINI_TEXT_MODEL") || "gemini-3.8-flash").split(",").map((x) => x.trim()).filter(Boolean);
    const PR = `Ets avaluador de propostes de millora per a l'app «Menú de Família» (menús setmanals, compra, rebost, receptes, veïnat). Per a cada proposta puntua de l'1 al 5: utilitat (u), originalitat (o) i viabilitat (v), i escriu un motiu en català de màxim 15 paraules (m). Les queixes sense proposta valen poc en originalitat. Respon NOMÉS amb JSON: {"<id>":{"u":n,"o":n,"v":n,"m":"..."}}.\n\n` +
      noves.map((x) => `[${x.key}] ${x.t.replace(/\s+/g, " ")}`).join("\n");
    for (const tm of models) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${tm}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(30000), headers: { "x-goog-api-key": gk, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: PR }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (!r.ok) continue;
        const j = await r.json();
        const t = ((j.candidates || [])[0]?.content?.parts || []).map((x: any) => x.text || "").join("");
        const o = JSON.parse(t);
        for (const x of noves) if (o[x.key]) PUNT[x.key] = { ...o[x.key], at: new Date().toISOString() };
        await merge("informe/idees", { p: PUNT });
        break;
      } catch (_) { /* prova el següent model */ }
    }
  }

  // Agregats per usuari
  type A = { ev7: any[]; ev14: any[] };
  const U: Record<string, A> = {};
  for (const e of ev) { const a = U[e.usuari] = U[e.usuari] || { ev7: [], ev14: [] }; (e.at >= d7 ? a.ev7 : a.ev14).push(e); }
  for (const x of idees) U[x.uid] = U[x.uid] || { ev7: [], ev14: [] };

  const cnt = (L: any[], t: string) => L.filter((e) => e.tipus === t).length;
  const rows = Object.entries(U).map(([uid, a]) => {
    const L = a.ev7;
    // Idees
    const ii = idees.filter((x) => x.uid === uid).map((x) => {
      const p = PUNT[x.key], n = NOTES[x.key];
      const nota = typeof n === "number" ? n : p ? (p.u + p.o + p.v) / 3 : 0;
      return { t: x.t, nota, m: typeof n === "number" ? "nota d'en Josep" : (p && p.m) || "sense puntuar" };
    });
    const sIdees = ii.reduce((s, x) => s + Math.max(0, x.nota - 2), 0); // només compten les idees per sobre de 2
    // Encert
    let bo = 0, mal = 0;
    for (const e of L) { bo += ENCERT_BO[e.tipus] || 0; mal += ENCERT_MAL[e.tipus] || 0; if (e.tipus === "tiquet_desat" && e.meta && e.meta.editat === false) bo += 1; }
    const sEncert = bo ? bo * (bo / (bo + mal)) : 0;
    // Iniciativa
    let sInic = 0; const xat = Math.min(cnt(L, "xat"), 15);
    for (const [t, w] of Object.entries(INICIATIVA)) sInic += (t === "xat" ? xat : cnt(L, t)) * w;
    return { uid, nom: NOM[uid] || uid.slice(0, 8), ii, sIdees, sEncert, sInic, bo, mal, L, L0: a.ev14 };
  });
  const mx = (f: (r: any) => number) => Math.max(1e-9, ...rows.map(f));
  const MI = mx((r) => r.sIdees), ME = mx((r) => r.sEncert), MN = mx((r) => r.sInic);
  for (const r of rows as any[]) r.total = Math.round((100 * (r.sIdees / MI) + 100 * (r.sEncert / ME) + 100 * (r.sInic / MN)) / 3);
  const rank = rows.filter((r: any) => r.total > 0).sort((a: any, b: any) => b.total - a.total);

  const motiu = (r: any) => {
    const p: string[] = [];
    if (r.ii.length) { const b = [...r.ii].sort((a: any, b: any) => b.nota - a.nota)[0]; p.push(`Idees: ${r.ii.length} (millor ${b.nota.toFixed(1)}/5 — «${b.t.slice(0, 70)}${b.t.length > 70 ? "…" : ""}»: ${b.m}).`); }
    const E: string[] = []; const L = r.L;
    if (cnt(L, "menu_crea")) E.push(`${cnt(L, "menu_crea")} menús`); if (cnt(L, "plat_ok")) E.push(`${cnt(L, "plat_ok")} plats confirmats`);
    if (cnt(L, "tiquet_desat")) E.push(`${cnt(L, "tiquet_desat")} tiquets`); if (cnt(L, "rebost_afegeix")) E.push(`${cnt(L, "rebost_afegeix")} entrades al rebost`);
    if (E.length) p.push(`Encert: ${E.join(", ")}${r.mal ? `; ${cnt(L, "elimina")} esborrats` : ", sense esborrats"}.`);
    const N: string[] = [];
    for (const [t, lab] of [["compra_conj_nova", "compres conjuntes obertes"], ["compra_conj_uneix", "compres conjuntes on s'apunta"], ["punt_crea", "punts de recollida"], ["convida", "invitacions"], ["foto_article", "fotos d'articles"], ["xat", "missatges al veïnat"]] as [string, string][]) if (cnt(L, t)) N.push(`${cnt(L, t)} ${lab}`);
    if (N.length) p.push(`Iniciativa: ${N.join(", ")}.`);
    return p.join(" ");
  };

  const ms = (v: number) => v >= 60000 ? `${Math.round(v / 60000)} min` : `${Math.round(v / 1000)} s`;
  const mitj = (L: any[], f: string, c: "dur_ms" | "passos") => { const x = L.filter((e) => e.meta && e.meta.flux === f && e.tipus !== "cancela" && e[c] != null); return x.length ? x.reduce((s, e) => s + e[c], 0) / x.length : null; };
  const us = rows.filter((r: any) => r.L.length || r.L0.length).map((r: any) => {
    const L = r.L, dies = new Set(L.map((e: any) => e.at.slice(0, 10))).size, dies0 = new Set(r.L0.map((e: any) => e.at.slice(0, 10))).size;
    const temps = L.filter((e: any) => e.tipus === "sessio").reduce((s: number, e: any) => s + (e.dur_ms || 0), 0);
    const canc: Record<string, number> = {}; L.filter((e: any) => e.tipus === "cancela").forEach((e: any) => { const f = (e.meta && e.meta.flux) || "?"; canc[f] = (canc[f] || 0) + 1; });
    const ra = mitj(L, "article", "dur_ms"), rp = mitj(L, "article", "passos");
    return { nom: r.nom, dies, dies0, temps, canc, ra, rp, mic: cnt(L, "mic_falla") };
  }).sort((a, b) => b.dies - a.dies);

  if (u.searchParams.get("format") === "json") return json({ rank: rank.map((r: any, i) => ({ pos: i + 1, nom: r.nom, total: r.total, motiu: motiu(r) })), us, idees: idees.length });

  const avui = new Intl.DateTimeFormat("ca-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  let o = `# Menú de Família · informe setmanal de talent\n${avui} · darrers 7 dies\n\n## Rànquing de talent\n`;
  o += rank.length ? rank.map((r: any, i) => `${i + 1}. **${r.nom}** — ${r.total}/100\n   ${motiu(r)}`).join("\n") : "Encara no hi ha prou dades (cap usuari ha acceptat l'avís o no hi ha activitat).";
  o += `\n\nPuntuació: mitjana d'idees, encert i iniciativa (100 = el millor de la setmana en cada apartat).\n\n## Ús (sense posició)\n`;
  o += us.length ? us.map((x) => {
    const c = Object.entries(x.canc).map(([f, n]) => `${f} ${n}`).join(", ");
    return `- **${x.nom}**: ${x.dies} dies actius (setmana anterior ${x.dies0}) · ${ms(x.temps)} a l'app` +
      (x.ra != null ? ` · afegir al rebost: ${ms(x.ra)} i ${Math.round(x.rp || 0)} tocs` : "") +
      (c ? ` · abandona: ${c}` : "") + (x.mic ? ` · micro falla ${x.mic} cops` : "");
  }).join("\n") : "Sense dades d'ús.";
  return txt(o + "\n");
});
