import { createHmac, timingSafeEqual } from "node:crypto";
import { synthesize } from "@/lib/tts/gemini";

/**
 * Voix Google (Gemini) pour les textes de communication (voix off de la vidéo de démonstration, 21/11).
 * Réservée aux automatisations du dépôt : la demande porte une signature HMAC calculée avec la clé de service
 * Supabase, valable 5 minutes. La clé Gemini ne quitte pas le serveur. Renvoie un WAV.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", gem = process.env.GEMINI_API_KEY ?? "";
  const { text, t, sig } = (await req.json().catch(() => ({}))) as { text?: string; t?: string; sig?: string };
  if (!cle || !text || !t || !sig || text.length > 1500) return new Response("demande invalide", { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return new Response("signature expirée", { status: 401 });
  const attendu = createHmac("sha256", cle).update(`${t}.${text}`).digest();
  const recu = Buffer.from(sig, "hex");
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) return new Response("signature refusée", { status: 401 });
  if (!gem) return new Response("clé Gemini absente", { status: 503 });
  const r = await synthesize(text, gem, 55000);
  if (!r.ok) return new Response(r.error.slice(0, 300), { status: r.status || 502 });
  return new Response(new Uint8Array(r.wav), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
}
