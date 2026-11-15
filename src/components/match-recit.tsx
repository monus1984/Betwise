"use client";

import { useEffect, useRef, useState } from "react";
import { CAT_LABEL, CAT_STYLE } from "@/lib/coach/categories";
import { pickVoice, spoken } from "@/lib/coach/voice";
import type { Choix, Etape } from "@/lib/matches/recit";
import { AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";

type Props = {
  match: { id: string; home: string; away: string; kickoff: string; comp: string; ouvert: boolean };
  etapes: Etape[]; verdict: Choix | null; autres: Choix[]; source: "marche" | "modele" | null;
};
const pct = (p: number) => Math.round(p * 100);
const cote = (c: Choix) => (c.cote ? c.cote.toFixed(2).replace(".", ",") : `≈ ${(1 / c.p / 1.05).toFixed(2).replace(".", ",")}`);

/** L'analyse d'un match, étape par étape, lue à voix haute si on le demande : l'étape en cours de lecture est mise en avant. */
export function MatchRecit({ match, etapes, verdict, autres, source }: Props) {
  const [canSpeak, setCanSpeak] = useState(false);
  const [lu, setLu] = useState<number | null>(null); // index de l'étape lue ; etapes.length = le verdict
  const run = useRef(0);
  useEffect(() => {
    setCanSpeak("speechSynthesis" in window);
    try { window.speechSynthesis?.getVoices(); } catch { /* chargées en arrière-plan */ }
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
  }, []);

  const blocs = [
    ...etapes.map((e) => `${e.titre}. ${e.lignes.join(" ")}`),
    verdict ? `Mon avis : ${verdict.label}. ${pct(verdict.p)} chances sur 100, catégorie ${CAT_LABEL[verdict.categorie]}.` : "Pas encore de cote sur ce match : je ne donne pas d’avis.",
  ];
  const stop = () => { run.current++; try { window.speechSynthesis.cancel(); } catch { /* ignore */ } setLu(null); };
  const lire = () => {
    const synth = window.speechSynthesis; if (!synth) return;
    synth.cancel();
    const id = ++run.current, voice = pickVoice(synth.getVoices());
    const dire = (i: number) => {
      if (id !== run.current) return;
      if (i >= blocs.length) { setLu(null); return; }
      setLu(i);
      const phrases = spoken(blocs[i]).split(/(?<=[.!?:])\s+/).filter(Boolean);
      phrases.forEach((ph, k) => {
        const u = new SpeechSynthesisUtterance(ph);
        u.lang = voice?.lang ?? "fr-FR"; u.rate = 0.95; u.pitch = 1.06;
        if (voice) u.voice = voice as SpeechSynthesisVoice;
        if (k === phrases.length - 1) { u.onend = () => dire(i + 1); u.onerror = () => { if (id === run.current) setLu(null); }; }
        synth.speak(u);
      });
    };
    dire(0);
  };

  const leg = (c: Choix) => legFrom({ matchId: match.id, home: match.home, away: match.away, kickoff: match.kickoff, comp: match.comp, market: c.market, param: c.param, sel: c.sel, p: c.p, cote: c.cote });
  const actif = (i: number) => (lu === i ? "border-brand bg-brand/5" : "border-line bg-white");

  return (
    <section className="space-y-2" aria-label="Analyse du match">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="font-display text-lg font-semibold">L’analyse BETWISE</h2>
        {canSpeak && (
          <button type="button" onClick={lu === null ? lire : stop} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${lu === null ? "bg-pitch text-white" : "border border-line bg-white text-ink"}`}>
            {lu === null ? "▶ Écouter l’analyse" : "■ Arrêter"}
          </button>
        )}
      </div>

      {etapes.length === 0 && <p className="rounded-xl border border-line bg-white p-3 text-sm text-ink-muted">Pas encore assez de données sur ces deux équipes pour dérouler une analyse (classement, derniers matchs). Le verdict ci-dessous repose sur les cotes seules.</p>}
      <ol className="space-y-2">
        {etapes.map((e, i) => (
          <li key={e.cle} className={`rounded-xl border p-3 transition-colors ${actif(i)}`}>
            <p className="text-[11px] font-semibold text-brand">{i + 1}. {e.titre}</p>
            {e.lignes.map((l, k) => <p key={k} className="mt-1 text-[13.5px] leading-snug">{l}</p>)}
          </li>
        ))}
      </ol>

      <div className={`rounded-xl border-2 p-3 transition-colors ${lu === etapes.length ? "border-brand bg-brand/5" : "border-pitch/30 bg-white"}`}>
        <p className="text-[11px] font-semibold text-brand">Le verdict</p>
        {verdict ? (
          <>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 font-display text-xl font-bold leading-tight">{verdict.label}</p>
              {match.ouvert && <AddToSlip leg={leg(verdict)} />}
            </div>
            <p className="mt-1 text-sm tabular-nums"><b>{pct(verdict.p)} chances sur 100</b> · cote {cote(verdict)} <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] ${CAT_STYLE[verdict.categorie]}`}>{CAT_LABEL[verdict.categorie]}</span></p>
            {autres.length > 0 && (
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {autres.map((c) => (
                  <li key={`${c.market}${c.param}${c.sel}`} className="flex items-center gap-2 py-1.5 text-[13px]">
                    <span className="w-16 shrink-0 text-[11px] text-ink-muted">{c.categorie === "sur" ? "Plus sûr" : "Plus osé"}</span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{pct(c.p)} % · {cote(c)}</span>
                    {match.ouvert && <AddToSlip size="sm" leg={leg(c)} />}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Le verdict est calculé d’après {source === "modele" ? "le modèle BETWISE" : "les cotes de référence"}, pas d’après les étapes ci-dessus : elles donnent le contexte, elles ne prouvent rien. « ≈ » : cote estimée, à comparer à celle de ton bookmaker.</p>
          </>
        ) : <p className="mt-1 text-sm text-ink-muted">Pas encore de cote sur ce match : pas d’avis pour l’instant.</p>}
      </div>
    </section>
  );
}
