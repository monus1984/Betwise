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
  // Le son muet joué pour déverrouiller le téléphone n'est pas coupé : l'interrompre peut annuler le déverrouillage (iPhone)
  try { if (player && player.src !== SILENCE) player.pause(); } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

/**
 * Niveau de la voix pour animer Betster (19/11). L'enveloppe sonore est calculée sur une copie décodée du fichier,
 * jamais sur la lecture elle-même : l'animation ne peut pas couper le son. Pas d'enveloppe pour la voix du téléphone.
 */
const PAS = 0.05; // une valeur toutes les 50 ms
const enveloppes = new Map<string, Float32Array>();
async function calculerEnveloppe(url: string, blob: Blob) {
  try {
    const Ctx = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx) return;
    const audio = await new Ctx(1, 1, 24000).decodeAudioData(await blob.arrayBuffer());
    const d = audio.getChannelData(0), n = Math.max(1, Math.round(audio.sampleRate * PAS));
    const env = new Float32Array(Math.ceil(d.length / n));
    let max = 0;
    for (let i = 0; i < env.length; i++) {
      let t = 0; const fin = Math.min(d.length, (i + 1) * n);
      for (let j = i * n; j < fin; j++) t += d[j] * d[j];
      env[i] = Math.sqrt(t / Math.max(1, fin - i * n)); max = Math.max(max, env[i]);
    }
    if (max > 0) for (let i = 0; i < env.length; i++) env[i] = Math.min(1, env[i] / (max * 0.7));
    enveloppes.set(url, env);
  } catch { /* pas d'animation fine, la lecture continue */ }
}
/** Entre 0 et 1 pendant que la voix du Coach joue ; null sinon (voix du téléphone, silence, pas encore calculé). */
export function niveauVoix(): number | null {
  if (!player || player.paused || !player.src) return null;
  const env = enveloppes.get(player.src);
  if (!env) return null;
  return env[Math.min(env.length - 1, Math.floor(player.currentTime / PAS))] ?? 0;
}

async function fetchVoice(text: string): Promise<string | null> {
  if (serveurKo) return null;
  try {
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) { if (r.status === 503 || r.status === 401) serveurKo = true; return null; }
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    void calculerEnveloppe(url, blob);
    return url;
  } catch { return null; }
}

/** Ce qui se passe côté son, pour que l'écran le dise : préparation, lecture, voix du téléphone, ou échec. */
export type EtatSon = "charge" | "joue" | "telephone" | "echec";

function phoneVoice(text: string, done: () => void, etat?: (e: EtatSon) => void) {
  try {
    const synth = window.speechSynthesis; if (!synth) { etat?.("echec"); return done(); }
    const voice = pickVoice(synth.getVoices());
    const parts = spoken(text).split(/(?<=[.!?:])\s+/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return done();
    parts.forEach((part, k) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang ?? "fr-FR"; u.rate = 0.95; u.pitch = 0.95;
      if (voice) u.voice = voice as SpeechSynthesisVoice;
      if (k === 0) u.onstart = () => etat?.("telephone");
      u.onerror = () => { etat?.("echec"); if (k === parts.length - 1) done(); };
      if (k === parts.length - 1) u.onend = done;
      synth.speak(u);
    });
  } catch { done(); }
}

/**
 * Lit des blocs de texte dans l'ordre. `onBlock(i)` annonce le bloc en cours, `onBlock(null)` la fin ou l'arrêt.
 * Un nouvel appel, ou stopSpeaking(), interrompt la lecture en cours.
 */
export function speakBlocks(blocks: string[], onBlock?: (i: number | null) => void, onEtat?: (e: EtatSon) => void, options: { telephone?: boolean } = {}) {
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
    const etat = (e: EtatSon) => { if (vivant()) onEtat?.(e); };
    // Sans repli sur la voix du téléphone : on s'arrête là et l'écran garde le texte
    const repli = () => { if (options.telephone === false) { etat("echec"); run++; } else phoneVoice(blocks[i], suite, etat); };
    etat("charge");
    const url = await demande(i);
    if (!vivant()) return;
    void demande(i + 1); // le bloc suivant se prépare pendant la lecture
    if (!url) return repli();
    try {
      if (!player) player = new Audio();
      const a = player;
      a.onended = () => { URL.revokeObjectURL(url); enveloppes.delete(url); suite(); };
      a.onerror = () => { URL.revokeObjectURL(url); if (vivant()) repli(); };
      a.onplaying = () => etat("joue");
      a.src = url;
      await a.play();
    } catch { if (vivant()) repli(); }
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
