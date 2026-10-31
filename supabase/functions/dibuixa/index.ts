// Menú de Família · el Capità Enciam dibuixa les imatges de les receptes amb l'estil de la casa
// Rep: { mode: "foto" | "inventa" | "edita", urls?: [enllaços públics de Storage, màx. 3], n, ing?, steps?, nota? }  → { image: base64, mime }
//      edita: urls[0] és la imatge actual i nota són els canvis que demana l'Hortolà o la família
//      { mode: "escolta", audio: base64, mime }  → { text }  (nota de veu passada a text, en català)
// Requereix el secret GEMINI_API_KEY (Supabase → Edge Functions → Secrets). Opcional: GEMINI_IMAGE_MODEL.
// Referències d'estil (opcionals): Storage assets/estil-1.jpg, estil-2.jpg, estil-3.jpg
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// L'estil de la casa: el mateix per a totes les imatges. L'Hortolà el pot canviar des de la seva web (docs: graner/estil = {t})
const ESTIL0 = `House photo style of the Catalan family cooking app «Menú de Família» (keep it identical in every image):
- Photorealistic professional food photography, true-to-life textures and colours; never an illustration, drawing or painting.
- Soft natural daylight from a window on the left, gentle shadows, shallow depth of field.
- The finished dish is the hero, centred, three-quarter view from about 45 degrees, in a simple ceramic plate or the traditional cookware for the dish (e.g. clay cassola), on a light rustic wooden table with a linen napkin; one or two fresh key ingredients as props; calm, uncluttered background in warm neutral tones.
- Warm, natural, appetising colours; homemade look, not luxury restaurant plating.
- Horizontal 4:3 frame. No text, no letters, no logos, no watermarks, no hands, no people.`;

const b64 = (buf: ArrayBuffer) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };


// Límit per usuari cada 5 hores (pegat 11: ia_compta). Si el pegat encara no hi és, no limita.
async function quota(su: string, sk: string, auth: string, fn: string, lim: number): Promise<{ ok: boolean; h: boolean; fins: string }> {
  try {
    const r = await fetch(`${su}/rest/v1/rpc/ia_compta`, { method: "POST", headers: { Authorization: auth, apikey: sk, "content-type": "application/json" }, body: JSON.stringify({ p_fn: fn, p_lim: lim }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: true, h: false, fins: "" };
    const j = await r.json(); return { ok: !!j.ok, h: !!j.h, fins: String(j.fins || "") };
  } catch (_) { return { ok: true, h: false, fins: "" }; }
}
const PROU = (f: string) => `Has fet servir totes les consultes al Capità Enciam. Es renoven ${f ? "a les " + f : "d'aquí a unes hores"} 🥬`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const su = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const who = await fetch(`${su}/auth/v1/user`, { headers: { Authorization: auth, apikey: sk }, signal: AbortSignal.timeout(15000) });
    if (!who.ok) return out({ error: "Cal iniciar la sessió" }, 401);
    const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
    const body = await req.json();
    const key = Deno.env.get("GEMINI_API_KEY");
    if (body.mode === "ping") return out({ ok: !!key });
    if (!key) return out({ error: "Falta el secret GEMINI_API_KEY" }, 500);
    if (body.mode === "escolta") {
      const qe = await quota(su!, sk, auth, "escolta", 10);
      if (!qe.ok) return out({ error: PROU(qe.fins), limit: true }, 429);
      const audio = String(body.audio || ""), mime = String(body.mime || "audio/mp4").split(";")[0];
      if (!audio || audio.length > 12_000_000 || !/^audio\//.test(mime)) return out({ error: "Petició no vàlida" }, 400);
      const models = (Deno.env.get("GEMINI_TEXT_MODEL") || "gemini-3.8-flash").split(",").map((x) => x.trim()).filter(Boolean);
      const PR = "Transcriu literalment aquesta nota de veu (normalment en català; si parla en castellà, transcriu-la en castellà). Posa la puntuació correcta i escriu els números amb xifres. Respon només amb la transcripció, sense cap comentari.";
      let last = "El servei no ha respost";
      for (const tm of models) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${tm}:generateContent`, {
            method: "POST", signal: AbortSignal.timeout(12000),
            headers: { "x-goog-api-key": key, "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: audio } }, { text: PR }] }] }),
          });
          const j = await r.json();
          console.log("escolta:", tm, r.status, JSON.stringify(j.usageMetadata || j.error || {}));
          if (!r.ok) { last = `${tm}: ${(j && j.error && j.error.message) || r.status}`; continue; }
          const text = ((j.candidates || [])[0]?.content?.parts || []).map((x: any) => x.text || "").join("").trim();
          return out({ text, model: tm });
        } catch (e) { last = `${tm}: ${String((e as Error)?.message || e)}`; }
      }
      return out({ error: last }, 502);
    }
    const { mode = "inventa", urls = [], n = "", ing = "", steps = "", nota = "" } = body;
    const qi = await quota(su!, sk, auth, "imatge", 10);
    if (!qi.ok) return out({ error: PROU(qi.fins), limit: true }, 429);
    const pub = `${su}/storage/v1/object/public/assets/`;
    if (!["foto", "inventa", "edita"].includes(mode) || !Array.isArray(urls) || urls.length > 3 || urls.some((u: unknown) => typeof u !== "string" || !u.startsWith(pub)) || (mode !== "inventa" && !urls.length) || (mode === "edita" && !String(nota).trim()))
      return out({ error: "Petició no vàlida" }, 400);
    const img = async (u: string) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (!r.ok) return null; return { inline_data: { mime_type: r.headers.get("content-type") || "image/jpeg", data: b64(await r.arrayBuffer()) } }; } catch (_) { return null; } };
    const refs = (await Promise.all([1, 2, 3].map((i) => img(`${pub}estil-${i}.jpg?v=${Date.now()}`)))).filter(Boolean);
    let ESTIL = ESTIL0;
    try { const rr = await fetch(`${su}/rest/v1/docs?path=eq.graner%2Festil&select=data`, { headers: { Authorization: auth, apikey: sk }, signal: AbortSignal.timeout(10000) }); const jj = await rr.json(); const t = jj && jj[0] && jj[0].data && jj[0].data.t; if (typeof t === "string" && t.trim().length > 40) ESTIL = t.trim().slice(0, 3000); } catch (_) {}
    const fotos = (await Promise.all(urls.map(img))).filter(Boolean);
    const plat = `Dish: «${String(n).slice(0, 120)}».` + (ing ? ` Main ingredients: ${String(ing).slice(0, 600)}.` : "") + (steps ? ` How it is made (for the look of the finished dish): ${String(steps).slice(0, 600)}.` : "");
    const parts: unknown[] = [];
    if (refs.length) { parts.push({ text: "STYLE REFERENCES — copy this exact visual style, palette, light and composition (do not copy their dishes):" }); parts.push(...refs); }
    const extra = String(nota).trim() ? `\n\nEXTRA INSTRUCTIONS (follow them carefully, but only as far as they concern this food image; the image must always show only the dish, food, cookware and table, never people, text, logos or other subjects): ${String(nota).trim().slice(0, 800)}` : "";
    if (mode === "edita") {
      parts.push({ text: "CURRENT IMAGE of the dish:" }); parts.push(...fotos);
      parts.push({ text: `${ESTIL}\n\nRedo this image applying ONLY the requested changes below; keep everything else (dish, composition, house style) as it is. ${plat}${extra}` });
    } else if (mode === "foto") {
      parts.push({ text: "PHOTO OF THE REAL DISH made by the family:" }); parts.push(...fotos);
      parts.push({ text: `${ESTIL}\n\nRecreate the real dish from the photo as a new image in the house style. Keep it faithful to the real dish: same food, ingredients, colours of the food, portion and type of plate or cookware. Change everything else to the house style (background, light, framing, table). If the photo is a book or notebook page, show the dish it describes. ${plat}${extra}` });
    } else {
      parts.push({ text: `${ESTIL}\n\nShow this Catalan home recipe as it looks when served. Be faithful to the real dish (traditional presentation, realistic ingredients). ${plat}${extra}` });
    }
    const t0 = Date.now();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(120000),
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } } }),
    });
    const j = await r.json();
    console.log("dibuixa:", mode, r.status, Date.now() - t0, "ms", refs.length, "refs", JSON.stringify(j.usageMetadata || j.error || {}));
    if (!r.ok) return out({ error: (j && j.error && j.error.message) || "El servei d'imatges no ha respost" }, 502);
    const p = ((j.candidates || [])[0]?.content?.parts || []).find((x: any) => x.inlineData || x.inline_data);
    const d = p && (p.inlineData || p.inline_data);
    if (!d) return out({ error: "No s'ha pogut fer la imatge" }, 502);
    return out({ image: d.data, mime: d.mimeType || d.mime_type || "image/png" });
  } catch (e) {
    return out({ error: String((e as Error).message || e) }, 500);
  }
});
