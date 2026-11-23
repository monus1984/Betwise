/**
 * Voix de Betster par OpenRouter (23/11, choisie par Mounir : modèle éco gpt-audio-mini, voix « ash »).
 * Le son arrive en flux PCM 16 bits à 24 kHz ; il est emballé en WAV, puis compressé en MP3 par l'appelant.
 * Coût mesuré le 23/11 : environ 0,0005 $ pour une phrase de 7 secondes.
 */
export type ResultatVoix = { ok: true; wav: Buffer } | { ok: false; status: number; error: string };

export const MODELE_VOIX = "openai/gpt-audio-mini";
const CONSIGNE = "Tu es Betster, un assistant de paris sportifs ivoirien, chaleureux et posé. Lis exactement le texte de l'utilisateur, à voix haute, en français, sans rien ajouter ni retirer. Lis les nombres à la française (1,51 se lit un virgule cinquante et un).";

export function enWav(pcm: Buffer, frequence = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(frequence, 24); h.writeUInt32LE(frequence * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Assemble le son d'une réponse en flux (lignes « data: {…} »). */
export function lireFlux(texte: string): Buffer {
  const morceaux: Buffer[] = [];
  for (const ligne of texte.split("\n")) {
    if (!ligne.startsWith("data: ") || ligne.includes("[DONE]")) continue;
    try { const d = JSON.parse(ligne.slice(6))?.choices?.[0]?.delta?.audio?.data; if (d) morceaux.push(Buffer.from(d, "base64")); } catch { /* ligne incomplète */ }
  }
  return Buffer.concat(morceaux);
}

export async function synthesizeOpenRouter(texte: string, cle: string, voix = "ash", ms = 20000): Promise<ResultatVoix> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(ms),
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELE_VOIX, modalities: ["text", "audio"], audio: { voice: voix, format: "pcm16" }, stream: true,
        messages: [{ role: "system", content: CONSIGNE }, { role: "user", content: texte }] }),
    });
    if (!r.ok) return { ok: false, status: r.status, error: (await r.text()).slice(0, 300) };
    const pcm = lireFlux(await r.text());
    return pcm.length ? { ok: true, wav: enWav(pcm) } : { ok: false, status: 502, error: "réponse sans son" };
  } catch (e) { return { ok: false, status: 504, error: e instanceof Error ? e.message : String(e) }; }
}
