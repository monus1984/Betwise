/**
 * Voix de Betster par Azure AI Speech (21/11, choix de Mounir : offre gratuite F0, 0,5 million de caractères par mois).
 * Clé et région côté serveur uniquement : AZURE_SPEECH_KEY, AZURE_SPEECH_REGION. Azure rend directement un MP3 mono
 * 24 kHz à 48 kbit/s : pas de compression à faire chez nous.
 */
export const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "fr-FR-HenriNeural";
const FORMAT = "audio-24khz-48kbitrate-mono-mp3";

export type AzureResult = { ok: true; mp3: Buffer } | { ok: false; status: number; error: string };

const echap = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Le texte à lire, enveloppé en SSML : voix d'homme, débit légèrement vif pour un ton d'analyste sportif. */
export function ssml(text: string, voice = AZURE_VOICE): string {
  const lang = voice.split("-").slice(0, 2).join("-") || "fr-FR";
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${echap(voice)}"><prosody rate="+5%">${echap(text)}</prosody></voice></speak>`;
}

export async function synthesizeAzure(text: string, key: string, region: string, ms = 20000): Promise<AzureResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": FORMAT, "User-Agent": "betwise" },
      body: ssml(text),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, status: r.status, error: (await r.text().catch(() => "")).slice(0, 300) || r.statusText };
    const mp3 = Buffer.from(await r.arrayBuffer());
    if (mp3.length < 200) return { ok: false, status: 502, error: "son vide" };
    return { ok: true, mp3 };
  } catch (e) {
    return { ok: false, status: 504, error: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(t); }
}
