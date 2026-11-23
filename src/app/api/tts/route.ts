import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spoken } from "@/lib/coach/voice";
import { synthesizeOpenRouter } from "@/lib/tts/openrouter";
import { synthesize } from "@/lib/tts/gemini";
import { wavToMp3 } from "@/lib/tts/mp3";
import { synthesizeAzure } from "@/lib/tts/azure";
import { synthesizePierre } from "@/lib/tts/pierre";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHARS = 1200;      // une étape d'analyse ou une réponse du Coach ; au-delà, le navigateur découpe

/**
 * Lit un texte avec la voix de Betster. Ordre : OpenRouter (gpt-audio-mini, voix « ash », choisie par Mounir le 23/11)
 * si sa clé existe, puis Azure si ses clés existent, puis Pierre (voix gratuite fabriquée par
 * api/voix.py, choisie par Mounir le 21/11), puis Gemini si sa clé existe.
 * Renvoie un MP3. Sans clé ou si les deux refusent : 503 avec { fallback: true } — l'écran garde alors le texte.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const azure = process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION ? { key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION } : null;
  const key = process.env.GEMINI_API_KEY;
  const clePierre = process.env.VOIX_PIERRE === "off" ? null : process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const cleOR = process.env.OPENROUTER_API_KEY;
  if (!cleOR && !azure && !clePierre && !key) return NextResponse.json({ fallback: true, error: "voix non configurée" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = spoken(typeof body?.text === "string" ? body.text : "").slice(0, MAX_CHARS);
  if (text.length < 2) return NextResponse.json({ error: "texte vide" }, { status: 400 });

  // Pas de plafond de lectures (décision de Mounir, 19/11). On continue de compter par compte et par jour, pour suivre le coût.
  await supabase.rpc("tts_take", { p_max: 1000000 });

  const debut = Date.now();
  if (cleOR) {
    const o = await synthesizeOpenRouter(text, cleOR, process.env.VOIX_BETSTER || "ash");
    if (o.ok) {
      const mp3 = wavToMp3(o.wav), son = mp3 ?? o.wav;
      console.log("[tts] ok openrouter", `${Date.now() - debut} ms`, `${text.length} caractères`, `${son.length} octets`, mp3 ? "mp3" : "wav");
      return new NextResponse(new Uint8Array(son), { status: 200, headers: { "Content-Type": mp3 ? "audio/mpeg" : "audio/wav", "Cache-Control": "private, no-store", "Content-Length": String(son.length) } });
    }
    console.warn("[tts] openrouter", o.status, o.error.slice(0, 200));
  }
  if (azure) {
    const a = await synthesizeAzure(text, azure.key, azure.region);
    if (a.ok) {
      console.log("[tts] ok azure", `${Date.now() - debut} ms`, `${text.length} caractères`, `${a.mp3.length} octets`);
      return new NextResponse(new Uint8Array(a.mp3), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "Content-Length": String(a.mp3.length) } });
    }
    console.warn("[tts] azure", a.status, a.error.slice(0, 200));
  }
  if (clePierre) {
    const p = await synthesizePierre(text, new URL(req.url).origin, clePierre, req.headers.get("cookie"));
    if (p.ok) {
      const mp3 = wavToMp3(p.wav);
      const son = mp3 ?? p.wav;
      console.log("[tts] ok pierre", `${Date.now() - debut} ms`, `${text.length} caractères`, `${son.length} octets`, mp3 ? "mp3" : "wav");
      return new NextResponse(new Uint8Array(son), { status: 200, headers: { "Content-Type": mp3 ? "audio/mpeg" : "audio/wav", "Cache-Control": "private, no-store", "Content-Length": String(son.length) } });
    }
    console.warn("[tts] pierre", p.status, p.error.slice(0, 200));
  }
  if (!key) return NextResponse.json({ fallback: true, error: "voix indisponible" }, { status: 503 });
  const r = await synthesize(text, key!);
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
