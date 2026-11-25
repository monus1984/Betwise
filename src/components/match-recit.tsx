"use client";
import { APP_NAME } from "@/lib/app-name";

import { useEffect, useState } from "react";
import { CAT_LABEL, CAT_STYLE } from "@/lib/coach/categories";
import { speakBlocks, stopSpeaking, unlockAudio } from "@/lib/coach/speak";
import type { Choix, Etape } from "@/lib/matches/recit";
import { AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";

type Props = {
  match: { id: string; home: string; away: string; kickoff: string; comp: string; ouvert: boolean };
  cles?: string[]; etapes: Etape[]; verdict: Choix | null; autres: Choix[]; source: "marche" | "modele" | null;
};
const pct = (p: number) => Math.round(p * 100);
const cote = (c: Choix) => (c.cote ? `${c.ou && c.ou !== "médiane" ? `${c.ou} ` : ""}${c.cote.toFixed(2).replace(".", ",")}` : `≈ ${(1 / c.p / 1.05).toFixed(2).replace(".", ",")}`);

/** L'analyse d'un match, étape par étape, lue à voix haute si on le demande : l'étape en cours de lecture est mise en avant. */
export function MatchRecit({ match, cles = [], etapes, verdict, autres, source }: Props) {
  // Lecture à voix haute (25/11) : l'essentiel puis le choix, plus tout le détail (bloc 0 = l'essentiel, 1 = le choix)
  const [lu, setLu] = useState<number | null>(null);
  useEffect(() => () => stopSpeaking(), []);

  const resume = cles.length ? cles.join(" ") : etapes.slice(0, 2).map((e) => e.lignes[0]).join(" ");
  const blocs = [
    resume,
    verdict ? `Le choix le plus probable : ${verdict.label}. ${pct(verdict.p)} chances sur 100${verdict.cote ? "" : ", c’est une estimation"}.` : "Pas encore de cote sur ce match : aucun choix à mettre en avant.",
  ];
  const stop = () => { stopSpeaking(); setLu(null); };
  const lire = () => { unlockAudio(); setLu(0); speakBlocks([`${match.home} contre ${match.away}. ${blocs[0]}`, ...blocs.slice(1)], setLu); };

  const leg = (c: Choix) => legFrom({ matchId: match.id, home: match.home, away: match.away, kickoff: match.kickoff, comp: match.comp, market: c.market, param: c.param, sel: c.sel, p: c.p, cote: c.cote });

  return (
    <section className="space-y-2" aria-label="Analyse du match">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="font-display text-lg font-semibold">L’analyse {APP_NAME}</h2>
        {(
          <button type="button" onClick={lu === null ? lire : stop} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${lu === null ? "bg-pitch text-white" : "border border-line bg-surface text-ink"}`}>
            {lu === null ? "▶ Écouter l’analyse" : "■ Arrêter"}
          </button>
        )}
      </div>

      {cles.length > 0 ? (
        <div className={`rounded-xl border p-3 transition-colors ${lu === 0 ? "border-brand bg-brand/5" : "border-line bg-surface"}`}>
          <p className="text-[11px] font-semibold text-brand">L’essentiel</p>
          <ul className="mt-1 space-y-1.5">
            {cles.map((c) => <li key={c} className="flex gap-2 text-[14px] leading-snug"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{c}</li>)}
          </ul>
        </div>
      ) : etapes.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-muted">Pas encore assez de données sur ces deux équipes (classement, derniers matchs). Le choix ci-dessous repose sur les cotes seules.</p>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-3 text-[13.5px] leading-snug text-ink-soft">Rien de tranché dans les chiffres de ces deux équipes : pas de série nette ni d’écart marqué. Le détail est plus bas.</p>
      )}

      <div className={`rounded-xl border-2 p-3 transition-colors ${lu === 1 ? "border-brand bg-brand/5" : "border-pitch/30 bg-surface"}`}>
        <p className="text-[11px] font-semibold text-brand">Ce que disent les chiffres</p>
        {verdict ? (
          <>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 font-display text-xl font-bold leading-tight">{verdict.label}</p>
              {match.ouvert && <AddToSlip leg={leg(verdict)} />}
            </div>
            <p className="mt-1 text-sm tabular-nums"><b>{pct(verdict.p)} chances sur 100</b> · {verdict.cote ? "cote " : ""}{cote(verdict)} <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] ${CAT_STYLE[verdict.categorie]}`}>{CAT_LABEL[verdict.categorie]}</span>{(!verdict.cote || source === "modele") && <span className="ml-1 rounded-full bg-draw-soft px-1.5 py-0.5 text-[10px] font-semibold text-draw-ink">estimation</span>}</p>
            {autres.length > 0 && (
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {autres.map((c) => (
                  <li key={`${c.market}${c.param}${c.sel}`} className="flex items-center gap-2 py-1.5 text-[13px]">
                    <span className="w-16 shrink-0 text-[11px] text-ink-muted">{c.categorie === "sur" ? "Plus probable" : "Plus osé"}</span>
                    <span className="min-w-0 flex-1"><span className="block leading-snug">{c.label}</span><span className="block text-[11.5px] tabular-nums text-ink-muted">{pct(c.p)} % · {cote(c)}</span></span>
                    {match.ouvert && <AddToSlip size="sm" leg={leg(c)} />}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Ce choix est calculé d’après {source === "modele" ? `le modèle ${APP_NAME}` : "les cotes de référence"}, pas d’après les faits ci-dessus : ils donnent le contexte, ils ne prouvent rien. « ≈ » : cote estimée, à comparer à celle de ton bookmaker.</p>
          </>
        ) : <p className="mt-1 text-sm text-ink-muted">Pas encore de cote sur ce match : aucun choix à mettre en avant pour l’instant.</p>}
      </div>
      {etapes.length > 0 && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-medium">Toute l’analyse <span className="text-ink-muted group-open:rotate-180">⌄</span></summary>
          <ol className="space-y-2.5 border-t border-line px-3 py-2.5">
            {etapes.map((e) => (
              <li key={e.cle}>
                <p className="text-[11px] font-semibold text-brand">{e.titre}</p>
                {e.lignes.map((l, k) => <p key={k} className="mt-0.5 text-[13px] leading-snug">{l}</p>)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
