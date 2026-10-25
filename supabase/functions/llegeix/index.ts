// Menú de Família · lectura de documents amb l'API de Claude
// Rep: { prompt, images: [base64 JPEG], model? }  ·  Retorna: { text, usage }
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
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return out({ error: "Falta el secret ANTHROPIC_API_KEY" }, 500);
    const { prompt, images = [], model } = await req.json();
    if (typeof prompt !== "string" || !prompt || !Array.isArray(images) || images.length > 8) return out({ error: "Petició no vàlida" }, 400);
    const content = [
      ...images.map((data: string) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
      { type: "text", text: prompt },
    ];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: model || "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content }] }),
    });
    const j = await r.json();
    if (!r.ok) return out({ error: (j && j.error && j.error.message) || "Error de l'API" }, 502);
    const text = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return out({ text, usage: j.usage });
  } catch (e) {
    return out({ error: String((e as Error).message || e) }, 500);
  }
});
