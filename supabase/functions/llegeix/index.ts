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
    const { prompt, images = [], urls = [], model } = await req.json();
    console.log("llegeix: cos llegit");
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
    const tm = setTimeout(() => ac.abort(), 120000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ac.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: model || "claude-sonnet-5-5", max_tokens: 16000, messages: [{ role: "user", content }] }),
    });
    const j = await r.json();
    clearTimeout(tm);
    console.log("llegeix: API", r.status, Date.now() - t0, "ms", JSON.stringify(j.usage || j.error || {}));
    if (!r.ok) return out({ error: (j && j.error && j.error.message) || "Error de l'API" }, 502);
    const text = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return out({ text, usage: j.usage });
  } catch (e) {
    console.error("llegeix: error", String((e as Error).message || e));
    if ((e as Error).name === "AbortError") return out({ error: "Claude ha trigat massa (més de 2 minuts)" }, 504);
    return out({ error: String((e as Error).message || e) }, 500);
  }
});
