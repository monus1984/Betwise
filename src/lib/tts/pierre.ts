/**
 * Voix gratuite « Pierre » (21/11) : fabriquée par la fonction Python api/voix.py du même déploiement.
 * La demande est signée (HMAC-SHA256 avec la clé de service Supabase, déjà présente côté serveur) : la clé ne circule
 * jamais, et une signature n'est valable que deux minutes pour ce texte précis.
 */
import { createHmac } from "node:crypto";

export type PierreResult = { ok: true; wav: Buffer } | { ok: false; status: number; error: string };

export function signer(texte: string, cle: string, t = Math.floor(Date.now() / 1000)) {
  return { t: String(t), sig: createHmac("sha256", cle).update(`${t}.${texte}`).digest("hex") };
}

export async function synthesizePierre(texte: string, origine: string, cle: string, cookie?: string | null, ms = 25000): Promise<PierreResult> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${origine}/api/voix`, {
      method: "POST",
      // Le cookie de la personne est transmis pour passer la protection des aperçus Vercel ; il n'est pas lu par la fonction
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ text: texte, ...signer(texte, cle) }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, status: r.status, error: (await r.text().catch(() => "")).slice(0, 200) || r.statusText };
    const wav = Buffer.from(await r.arrayBuffer());
    if (wav.length < 1000 || wav.toString("ascii", 0, 4) !== "RIFF") return { ok: false, status: 502, error: "son invalide" };
    return { ok: true, wav };
  } catch (e) {
    return { ok: false, status: 504, error: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(minuteur); }
}
