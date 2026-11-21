"use client";

import { useEffect, useState } from "react";
import { AIDES, type SectionAide } from "@/lib/aide/contenu";
import { speakBlocks, stopSpeaking, unlockAudio, type EtatSon } from "@/lib/coach/speak";

/**
 * « Comment ça marche ? » : une aide courte, à la demande (jamais imposée), lisible à voix haute par Pierre.
 * La phrase lue est surlignée : c'est le sous-titre. Sans voix (quota, réseau), le texte reste à l'écran.
 */
export function Aide({ section, clair }: { section: SectionAide; clair?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [lue, setLue] = useState<number | null>(null);
  const [etat, setEtat] = useState<EtatSon | null>(null);
  const a = AIDES[section];
  useEffect(() => () => stopSpeaking(), []);
  const fermer = () => { stopSpeaking(); setLue(null); setEtat(null); setOuvert(false); };
  const ecouter = () => {
    if (lue !== null) { stopSpeaking(); setLue(null); setEtat(null); return; }
    unlockAudio();
    speakBlocks(a.etapes, (i) => { setLue(i); if (i === null) setEtat(null); }, setEtat, { telephone: false });
  };
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} aria-label={`Comment ça marche : ${a.titre}`}
        className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${clair ? "border-line bg-surface text-ink-soft" : "border-white/30 bg-white/10 text-white"}`}>
        <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${clair ? "bg-inverse text-on-inverse" : "bg-white/90 text-ink"}`}>?</span>Aide
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" role="dialog" aria-modal="true" aria-label={a.titre} onClick={fermer}>
          <div className="w-full max-w-xl rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div><p className="text-[11px] text-ink-muted">Comment ça marche ?</p><h2 className="text-base font-semibold">{a.titre}</h2></div>
              <button type="button" onClick={fermer} className="rounded-full px-2 py-1 text-sm text-ink-muted" aria-label="Fermer">✕</button>
            </div>
            <ol className="space-y-2.5 text-[14px] leading-snug">
              {a.etapes.map((e, i) => (
                <li key={i} className={`flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${lue === i ? "bg-brand-soft" : ""}`}>
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-soft">{i + 1}</span>
                  <span>{e}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={ecouter} className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-on-fill">
                {lue !== null ? (etat === "charge" ? "Préparation de la voix…" : "Arrêter") : "Écouter (30 s)"}
              </button>
              <button type="button" onClick={fermer} className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-soft">Fermer</button>
            </div>
            {etat === "echec" && <p className="mt-2 text-[11px] text-ink-muted">La voix n’est pas disponible pour le moment : le texte reste ici.</p>}
          </div>
        </div>
      )}
    </>
  );
}
