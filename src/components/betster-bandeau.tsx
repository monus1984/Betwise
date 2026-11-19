"use client";
/**
 * Bandeau Betster de l'accueil (19/11). Le bouton fait parler Betster : il lit le point du jour (opportunités,
 * probabilités, raisons tirées des données), bloc par bloc, avec le texte affiché en sous-titre. Il n'ouvre plus
 * la conversation ; celle-ci reste accessible par le lien « Poser une question » et par Betster flottant.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { BetsterAnime } from "@/components/betster-anime";
import { speakBlocks, stopSpeaking, unlockAudio, type EtatSon } from "@/lib/coach/speak";

export function BandeauBetster({ prenom, synthese, maj, expression, briefing }: { prenom: string; synthese: string; maj: string; expression: string; briefing: string[] }) {
  const [bloc, setBloc] = useState<number | null>(null);
  const [son, setSon] = useState<EtatSon>("charge");
  const parle = bloc !== null;
  useEffect(() => () => stopSpeaking(), []);
  const ecouter = () => {
    if (parle) { stopSpeaking(); setBloc(null); return; }
    unlockAudio(); setBloc(0); setSon("charge");
    speakBlocks(briefing, (i) => setBloc(i), setSon);
  };
  return (
    <section aria-label="Betster" className="card-hero flex flex-col gap-3 rounded-[22px] p-4" data-expression={expression}>
      <div className="flex items-start gap-3">
        <BetsterAnime etat={!parle ? "repos" : son === "charge" ? "pense" : "parle"} taille={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-brand">Betster{parle ? ` · ${bloc! + 1} sur ${briefing.length}` : ""}</p>
          {!parle && <p className="text-[16px] font-bold leading-snug">Bonjour{prenom ? ` ${prenom}` : ""} !</p>}
          {parle && son === "charge" && <p className="mt-1 text-[11.5px] text-ink-muted">Je prépare ma voix…</p>}
          {parle && son === "telephone" && <p className="mt-1 text-[11.5px] text-ink-muted">La voix de Betster n’est pas disponible pour l’instant : je continue avec la voix du téléphone.</p>}
          {parle && son === "echec" && <p className="mt-1 text-[11.5px] font-semibold text-draw-ink">Le son n’a pas pu démarrer sur ce téléphone. Vérifie le volume « Multimédia », puis réessaie.</p>}
          <p className={`mt-1 leading-snug ${parle ? "text-[14px] text-ink" : "text-[13.5px] text-ink-soft"}`} aria-live="polite">{parle ? briefing[bloc!] : synthese}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[11px] leading-tight text-ink-muted">Mis à jour à {maj} · <Link href="/coach?v=discussion" className="font-semibold text-brand">Poser une question</Link></span>
        <button type="button" onClick={ecouter} aria-pressed={parle} className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-bold active:opacity-90 ${parle ? "bg-inverse text-on-inverse" : "bg-brand text-on-fill"}`}>
          {parle
            ? <><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>Arrêter</>
            : <><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>Écouter Betster</>}
        </button>
      </div>
    </section>
  );
}
