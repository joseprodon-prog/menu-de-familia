// Menú de Família · lectura de documents amb l'API de Claude
// Rep: { prompt, urls: [enllaços públics de Storage] | images: [base64 JPEG], model? }  ·  Retorna: { text, usage }
// Requereix el secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Només usuaris amb sessió iniciada a l'app
    console.log("llegeix: inici", req.headers.get("content-length"));
    const auth = req.headers.get("Authorization") || "";
    const su = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const who = await fetch(`${su}/auth/v1/user`, { headers: { Authorization: auth, apikey: sk }, signal: AbortSignal.timeout(15000) });
    console.log("llegeix: sessió", who.status);
    if (!who.ok) return out({ error: "Cal iniciar la sessió" }, 401);
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return out({ error: "Falta el secret ANTHROPIC_API_KEY" }, 500);
    const body = await req.json();
    const { prompt, images = [], urls = [], model, web = false } = body;
    console.log("llegeix: cos llegit");
    // mode xat: missatges + eines definides per l'app (l'app executa les eines i torna a cridar)
    if (Array.isArray(body.messages)) {
      const ms = body.messages, tl = Array.isArray(body.tools) ? body.tools : [];
      if (!ms.length || ms.length > 60 || tl.length > 20 || JSON.stringify(body).length > 400000) return out({ error: "Petició no vàlida" }, 400);
      const tools = tl.map((t: any) => ({ name: String(t.name).slice(0, 64), description: String(t.description || "").slice(0, 1000), input_schema: t.input_schema || { type: "object", properties: {} } }));
      const t1 = Date.now();
      const rr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: AbortSignal.timeout(120000),
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: model || "claude-sonnet-5-5", max_tokens: 6000, ...(typeof body.system === "string" ? { system: body.system.slice(0, 20000) } : {}), messages: ms, ...(tools.length ? { tools } : {}) }),
      });
      const jj = await rr.json();
      console.log("llegeix: xat", rr.status, Date.now() - t1, "ms", JSON.stringify(jj.usage || jj.error || {}));
      if (!rr.ok) return out({ error: (jj && jj.error && jj.error.message) || "Error de l'API" }, 502);
      const tx = (jj.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      return out({ text: tx, content: jj.content, stop_reason: jj.stop_reason, usage: jj.usage });
    }
    const pub = `${su}/storage/v1/object/public/assets/`;
    if (typeof prompt !== "string" || !prompt || !Array.isArray(images) || !Array.isArray(urls) || images.length + urls.length > 8 ||
        urls.some((u: unknown) => typeof u !== "string" || !u.startsWith(pub))) return out({ error: "Petició no vàlida" }, 400);
    const content = [
      ...urls.map((url: string) => ({ type: "image", source: { type: "url", url } })),
      ...images.map((data: string) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
      { type: "text", text: prompt },
    ];
    const t0 = Date.now();
    console.log("llegeix: imatges", urls.length + images.length);
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 140000);
    const msgs: unknown[] = [{ role: "user", content }];
    let j: any = null, r: Response | null = null, all: { type: string; text?: string }[] = [];
    for (let turn = 0; turn < 3; turn++) {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ac.signal,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: model || "claude-sonnet-5-5", max_tokens: 16000, messages: msgs,
          ...(web ? { tools: [{ type: "web_fetch_20260318", name: "web_fetch", max_uses: 4 }] } : {}),
        }),
      });
      j = await r.json();
      if (!r.ok) break;
      all = all.concat(j.content || []);
      // amb eines de servidor, el torn es pot pausar: es continua amb el que ja s'ha generat
      if (j.stop_reason !== "pause_turn") break;
      msgs.push({ role: "assistant", content: j.content });
    }
    clearTimeout(tm);
    console.log("llegeix: API", r && r.status, Date.now() - t0, "ms", web ? "web" : "", JSON.stringify(j.usage || j.error || {}));
    if (!r || !r.ok) return out({ error: (j && j.error && j.error.message) || "Error de l'API" }, 502);
    // amb web_fetch, la resposta final és el text que ve després de l'últim resultat de l'eina
    const blocks = all;
    let last = -1; blocks.forEach((b, i) => { if (b.type === "web_fetch_tool_result") last = i; });
    const text = blocks.slice(last + 1).filter((c) => c.type === "text").map((c) => c.text || "").join("");
    return out({ text, usage: j.usage });
  } catch (e) {
    console.error("llegeix: error", String((e as Error).message || e));
    if ((e as Error).name === "AbortError") return out({ error: "Claude ha trigat massa (més de 2 minuts)" }, 504);
    return out({ error: String((e as Error).message || e) }, 500);
  }
});
