/**
 * Voix du Coach par la synthèse vocale de Gemini (clé GEMINI_API_KEY, côté serveur uniquement).
 * Deux formes d'appel existent chez Google : l'API « interactions » (actuelle) et generateContent (ancienne).
 * On essaie la première, puis la seconde, pour ne pas dépendre d'une seule.
 * Le son revient en WAV, ou en PCM brut 24 kHz 16 bits mono qu'on enveloppe alors dans un en-tête WAV.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
export const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";
/** Consigne de ton : une présentatrice sportive, chaleureuse et vive, qui articule. */
export const TTS_STYLE = process.env.GEMINI_TTS_STYLE || "voix de femme chaleureuse, énergique et dynamique, ton d'une présentatrice sportive francophone, articulation nette, débit posé";

export type TtsResult = { ok: true; wav: Buffer } | { ok: false; status: number; error: string };

export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE((sampleRate * channels * bits) / 8, 28); h.writeUInt16LE((channels * bits) / 8, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export const asWav = (b: Buffer) => (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE" ? b : pcmToWav(b));

type Json = Record<string, unknown>;
/** Le son dans une réponse « interactions » : dernier contenu audio d'une étape de sortie du modèle. */
export function audioFromInteraction(j: Json): string | null {
  const steps = Array.isArray(j.steps) ? (j.steps as Json[]) : [];
  let data: string | null = null;
  for (const s of steps) if (s.type === "model_output" && Array.isArray(s.content)) for (const c of s.content as Json[]) if (c.type === "audio" && typeof c.data === "string") data = c.data;
  return data;
}
/** Le son dans une réponse generateContent. */
export function audioFromGenerate(j: Json): string | null {
  const parts = ((j.candidates as Json[] | undefined)?.[0]?.content as Json | undefined)?.parts as Json[] | undefined;
  for (const p of parts ?? []) { const d = ((p.inlineData ?? p.inline_data) as Json | undefined)?.data; if (typeof d === "string") return d; }
  return null;
}

async function post(url: string, key: string, body: unknown, signal: AbortSignal) {
  const r = await fetch(url, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const j = (await r.json().catch(() => ({}))) as Json;
  return { status: r.status, j, message: ((j.error as Json | undefined)?.message as string | undefined) ?? "" };
}

export async function synthesize(text: string, key: string, ms = 25000): Promise<TtsResult> {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const a = await post(`${BASE}/interactions`, key, {
      model: TTS_MODEL,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: TTS_STYLE }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: TTS_VOICE }] },
    }, ctl.signal);
    const da = a.status === 200 ? audioFromInteraction(a.j) : null;
    if (da) return { ok: true, wav: asWav(Buffer.from(da, "base64")) };
    if (a.status === 401 || a.status === 403 || a.status === 429) return { ok: false, status: a.status, error: a.message || "clé refusée ou quota atteint" };

    const b = await post(`${BASE}/models/${TTS_MODEL}:generateContent`, key, {
      contents: [{ role: "user", parts: [{ text, speech_metadata: { style: TTS_STYLE } }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice: TTS_VOICE } } },
    }, ctl.signal);
    const db = b.status === 200 ? audioFromGenerate(b.j) : null;
    if (db) return { ok: true, wav: asWav(Buffer.from(db, "base64")) };
    return { ok: false, status: b.status === 200 ? 502 : b.status, error: b.message || a.message || "réponse sans son" };
  } catch (e) {
    return { ok: false, status: 504, error: e instanceof Error && e.name === "AbortError" ? "délai dépassé" : "service de voix injoignable" };
  } finally { clearTimeout(timer); }
}
