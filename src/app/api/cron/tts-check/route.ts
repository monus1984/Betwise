import { NextResponse } from "next/server";
import { synthesize, TTS_MODEL, TTS_VOICE } from "@/lib/tts/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Contrôle de la voix : fait lire une phrase courte au service de synthèse et dit si le son est revenu.
 * Protégé par le même secret que les autres routes planifiées. Ne renvoie jamais la clé ni le son.
 */
export async function POST(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ ok: false, cle: false, erreur: "GEMINI_API_KEY absente de ce déploiement" });
  const t0 = Date.now();
  const r = await synthesize("Belgique contre Italie. Mon avis : la Belgique ne perd pas.", key);
  const ms = Date.now() - t0;
  if (!r.ok) return NextResponse.json({ ok: false, cle: true, modele: TTS_MODEL, voix: TTS_VOICE, statut: r.status, erreur: r.error.slice(0, 300), ms });
  return NextResponse.json({ ok: true, cle: true, modele: TTS_MODEL, voix: TTS_VOICE, octets: r.wav.length, secondes: Math.round(((r.wav.length - 44) / 48000) * 10) / 10, ms });
}
