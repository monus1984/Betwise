"use client";

import { useEffect, useRef, useState } from "react";

type RecEvent = { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } };
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: RecEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const ctor = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Dictée gratuite du navigateur (Chrome Android, Safari iOS récent), en français. Le texte reconnu s'affiche au fil
 * de la parole et reste modifiable : rien n'est enregistré sans relecture. Sans dictée dans le navigateur, on propose
 * le micro du clavier du téléphone, qui fait la même chose.
 */
export function Dictee({ onTexte, onFin, disabled }: { onTexte: (t: string) => void; onFin?: (t: string) => void; disabled?: boolean }) {
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [ecoute, setEcoute] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  useEffect(() => { setDispo(!!ctor()); return () => { try { rec.current?.abort(); } catch { /* ignore */ } }; }, []);

  function basculer() {
    const C = ctor();
    if (!C || disabled) return;
    if (ecoute) { rec.current?.stop(); return; }
    const r = new C();
    r.lang = "fr-FR"; r.interimResults = true; r.continuous = true;
    let final = "";
    r.onresult = (e) => {
      let provisoire = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += `${t} `; else provisoire += t; }
      onTexte(`${final}${provisoire}`.trim());
    };
    r.onerror = (e) => {
      setEcoute(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setErr("Micro refusé : autorise le micro dans les réglages du navigateur, ou utilise le micro du clavier.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setErr("La dictée n’a pas fonctionné. Réessaie, ou utilise le micro du clavier.");
    };
    r.onend = () => { setEcoute(false); if (final.trim()) onFin?.(final.trim()); };
    rec.current = r; setErr(null); setEcoute(true);
    try { r.start(); } catch { setEcoute(false); }
  }

  if (dispo === false) return <p className="text-[11px] text-ink-muted">Dictée indisponible dans ce navigateur : touche le micro du clavier de ton téléphone dans le champ ci-dessus, ça marche pareil.</p>;
  return (
    <div>
      <button type="button" onClick={basculer} disabled={disabled || dispo === null} aria-pressed={ecoute}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${ecoute ? "border-loss bg-loss text-on-fill" : "border-line bg-surface text-ink"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        {ecoute ? "J’écoute… touche pour arrêter" : "Dicter"}
      </button>
      {err && <p className="mt-1.5 text-[11px] text-loss-ink">{err}</p>}
    </div>
  );
}
