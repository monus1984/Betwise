import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spoken } from "@/lib/coach/voice";
import { synthesize } from "@/lib/tts/gemini";
import { wavToMp3 } from "@/lib/tts/mp3";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHARS = 1200;      // une étape d'analyse ou une réponse du Coach ; au-delà, le navigateur découpe
const LECTURES_PAR_JOUR = 80; // par compte, pendant le test

/**
 * Lit un texte avec la voix du Coach. Renvoie un MP3 (douze fois plus léger que le WAV d'origine), ou le WAV si la compression échoue.
 * Sans clé, en cas de quota ou de panne : 503 avec { fallback: true } — le téléphone lit alors avec sa propre voix.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ fallback: true, error: "voix non configurée" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = spoken(typeof body?.text === "string" ? body.text : "").slice(0, MAX_CHARS);
  if (text.length < 2) return NextResponse.json({ error: "texte vide" }, { status: 400 });

  const { data: ok, error } = await supabase.rpc("tts_take", { p_max: LECTURES_PAR_JOUR });
  if (error || !ok) return NextResponse.json({ fallback: true, error: "limite de lectures du jour atteinte" }, { status: 503 });

  const debut = Date.now();
  const r = await synthesize(text, key);
  if (!r.ok) {
    console.warn("[tts]", r.status, r.error.slice(0, 200));
    return NextResponse.json({ fallback: true, error: "voix indisponible" }, { status: 503 });
  }
  let mp3: Buffer | null = null;
  try { mp3 = wavToMp3(r.wav); } catch (e) { console.warn("[tts] compression", e instanceof Error ? e.message : e); }
  const son = mp3 ?? r.wav;
  console.log("[tts] ok", `${Date.now() - debut} ms`, `${text.length} caractères`, `${son.length} octets`, mp3 ? "mp3" : "wav");
  return new NextResponse(new Uint8Array(son), { status: 200, headers: { "Content-Type": mp3 ? "audio/mpeg" : "audio/wav", "Cache-Control": "private, no-store", "Content-Length": String(son.length) } });
}
