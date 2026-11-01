// Menú de Família · avisos del rebost al mòbil (web push)
// La crida el cron diari de Supabase (pegat 19). Llegeix families/<codi>/dades/avisos {L:[{n,dia,fi,cg}], enviat:{}}
// i, si avui és dins [dia, fi], envia un avís a tots els mòbils de la família (data/users/<uid>/push {subs}).
// Secrets: VAPID_PUBLIC, VAPID_PRIVATE, AVISOS_KEY. Desplega amb --no-verify-jwt.
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.headers.get("x-avisos-key") !== Deno.env.get("AVISOS_KEY")) return json({ error: "no" }, 401);
  const su = Deno.env.get("SUPABASE_URL")!, sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  webpush.setVapidDetails("https://menu-de-familia.pages.dev", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);
  const H = { apikey: sr, Authorization: `Bearer ${sr}`, "Content-Type": "application/json" };
  const get = async (q: string) => { const r = await fetch(`${su}/rest/v1/docs?${q}`, { headers: H }); return r.ok ? await r.json() : []; };
  const merge = (p_path: string, p_patch: unknown) => fetch(`${su}/rest/v1/rpc/doc_merge`, { method: "POST", headers: H, body: JSON.stringify({ p_path, p_patch }) });
  const avui = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  const docs = await get("select=path,data&path=like.families/*/dades/avisos");
  let enviats = 0;
  for (const d of docs) {
    const code = String(d.path).split("/")[1], data = d.data || {}, env = data.enviat || {};
    const L = (Array.isArray(data.L) ? data.L : []).filter((x: any) => x && x.n && x.dia <= avui && avui <= x.fi && !env[`${x.n}|${x.fi}`]);
    if (!L.length) continue;
    const fam = (await get(`select=data&path=eq.${encodeURIComponent("families/" + code)}`))[0];
    const uids = Object.keys((fam && fam.data && fam.data.membres) || {}).filter((u) => fam.data.membres[u]);
    const nom = (x: any) => String(x.n).toLowerCase();
    const quan = (x: any) => x.fi === avui ? "s'acaba avui" : "s'acaba aviat";
    const body = L.length === 1
      ? `${L[0].n} ${quan(L[0])}. ${L[0].cg ? "Congela'l si no el fareu servir." : "Consumiu-lo aviat."}`
      : `${L.length} aliments s'acaben aviat: ${L.slice(0, 4).map(nom).join(", ")}${L.length > 4 ? "…" : ""}. ${L.some((x: any) => x.cg) ? "Alguns es poden congelar." : ""}`;
    const msg = JSON.stringify({ title: "Avisos del rebost", body, tag: "rebost-" + avui, url: "./?av=1" });
    for (const uid of uids) {
      const pd = (await get(`select=data&path=eq.${encodeURIComponent("data/users/" + uid + "/push")}`))[0];
      const subs = (pd && pd.data && pd.data.subs) || {};
      for (const [id, s] of Object.entries(subs) as [string, any][]) {
        if (!s || !s.endpoint) continue;
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, msg, { TTL: 86400 }); enviats++; }
        catch (e) { const st = (e as any)?.statusCode; if (st === 404 || st === 410) await merge(`data/users/${uid}/push`, { subs: { [id]: null } }); }
      }
    }
    await merge(d.path, { enviat: Object.fromEntries(L.map((x: any) => [`${x.n}|${x.fi}`, avui])) });
  }
  return json({ ok: true, avui, enviats });
});
