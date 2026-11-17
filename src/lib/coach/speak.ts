"use client";
/**
 * Lecture à voix haute : la voix du Coach (serveur, /api/tts) quand elle est disponible, sinon la voix du téléphone.
 * Les blocs sont lus l'un après l'autre ; pendant qu'un bloc est lu, le suivant est déjà demandé au serveur.
 */
import { pickVoice, spoken } from "./voice";

let run = 0;
let player: HTMLAudioElement | null = null;
let serveurKo = false; // la voix serveur a répondu « indisponible » : on n'insiste plus pendant cette visite
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/** À appeler dans le geste de l'utilisateur (appui) : sans cela, iPhone refuse de jouer un son obtenu après coup. */
export function unlockAudio() {
  try {
    if (!player) player = new Audio();
    player.src = SILENCE; void player.play().catch(() => {});
    const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis?.speak(u);
  } catch { /* ignore */ }
}

export function stopSpeaking() {
  run++;
  try { player?.pause(); } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

async function fetchVoice(text: string): Promise<string | null> {
  if (serveurKo) return null;
  try {
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) { if (r.status === 503 || r.status === 401) serveurKo = true; return null; }
    return URL.createObjectURL(await r.blob());
  } catch { return null; }
}

function phoneVoice(text: string, done: () => void) {
  try {
    const synth = window.speechSynthesis; if (!synth) return done();
    const voice = pickVoice(synth.getVoices());
    const parts = spoken(text).split(/(?<=[.!?:])\s+/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return done();
    parts.forEach((part, k) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang ?? "fr-FR"; u.rate = 0.95; u.pitch = 1.06;
      if (voice) u.voice = voice as SpeechSynthesisVoice;
      if (k === parts.length - 1) { u.onend = done; u.onerror = done; }
      synth.speak(u);
    });
  } catch { done(); }
}

/**
 * Lit des blocs de texte dans l'ordre. `onBlock(i)` annonce le bloc en cours, `onBlock(null)` la fin ou l'arrêt.
 * Un nouvel appel, ou stopSpeaking(), interrompt la lecture en cours.
 */
export function speakBlocks(blocks: string[], onBlock?: (i: number | null) => void) {
  stopSpeaking();
  const id = ++run;
  const vivant = () => id === run;
  const urls: (Promise<string | null> | undefined)[] = [];
  const demande = (i: number) => (i < blocks.length ? (urls[i] ??= fetchVoice(blocks[i])) : undefined);
  const lire = async (i: number) => {
    if (!vivant()) return;
    if (i >= blocks.length) { onBlock?.(null); return; }
    onBlock?.(i);
    const suite = () => { if (vivant()) void lire(i + 1); };
    const url = await demande(i);
    if (!vivant()) return;
    void demande(i + 1); // le bloc suivant se prépare pendant la lecture
    if (!url) return phoneVoice(blocks[i], suite);
    try {
      if (!player) player = new Audio();
      const a = player;
      a.onended = () => { URL.revokeObjectURL(url); suite(); };
      a.onerror = () => { URL.revokeObjectURL(url); if (vivant()) phoneVoice(blocks[i], suite); };
      a.src = url;
      await a.play();
    } catch { if (vivant()) phoneVoice(blocks[i], suite); }
  };
  void lire(0);
}

/** Lit un texte libre (réponse du Coach) : une seule demande de voix par réponse, sauf texte très long. */
export function speakText(text: string, onDone?: () => void) {
  const phrases = spoken(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const blocks: string[] = [];
  for (const ph of phrases) { const last = blocks[blocks.length - 1]; if (last !== undefined && (last + " " + ph).length <= 1150) blocks[blocks.length - 1] = last + " " + ph; else blocks.push(ph); }
  speakBlocks(blocks.length ? blocks : [text], (i) => { if (i === null) onDone?.(); });
}
