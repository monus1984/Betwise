"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OptionRecherche } from "@/lib/accueil/load";
import { COMP_FLAG } from "@/components/match-ui";
import { estTop5 } from "@/lib/competitions";

const PAS = [40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const C = (x: number) => x.toFixed(2).replace(".", ",");

/** « Je cherche entre 70 et 80 % » : les options du jour dans la fourchette, des matchs les plus proches aux plus lointains. */
export function RecherchePourcentage({ options }: { options: OptionRecherche[] }) {
  const [min, setMin] = useState(70);
  const [max, setMax] = useState(80);
  const [tri, setTri] = useState<"heure" | "proba">("heure");
  const [vus, setVus] = useState(10);
  const liste = useMemo(() => {
    const l = options.filter((o) => o.p * 100 >= min && o.p * 100 <= max);
    // un seul choix par match et par heure : le plus probable dans la fourchette
    const parMatch = new Map<string, OptionRecherche[]>();
    for (const o of l) parMatch.set(o.matchId, [...(parMatch.get(o.matchId) ?? []), o]);
    const r = [...parMatch.values()].flatMap((x) => x.sort((a, b) => b.p - a.p).slice(0, 2));
    // les 5 grands championnats d'abord, puis l'ordre choisi
    const top = (o: OptionRecherche) => Number(!estTop5(o.comp));
    return r.sort((a, b) => top(a) - top(b) || (tri === "heure" ? Date.parse(a.kickoff) - Date.parse(b.kickoff) || b.p - a.p : b.p - a.p));
  }, [options, min, max, tri]);
  if (!options.length) return null;
  const sel = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-semibold tabular-nums";
  return (
    <section aria-label="Chercher par probabilité" className="mt-6">
      <h2 className="text-[17px] font-bold">Chercher par probabilité</h2>
      <div className="tile mt-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Entre</span>
          <select aria-label="Probabilité minimale" value={min} onChange={(e) => { const v = Number(e.target.value); setMin(v); if (v > max) setMax(v); setVus(10); }} className={sel}>{PAS.map((x) => <option key={x} value={x}>{x} %</option>)}</select>
          <span className="text-ink-soft">et</span>
          <select aria-label="Probabilité maximale" value={max} onChange={(e) => { const v = Number(e.target.value); setMax(v); if (v < min) setMin(v); setVus(10); }} className={sel}>{[...PAS.slice(1), 100].map((x) => <option key={x} value={x}>{x} %</option>)}</select>
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-ink-muted">{liste.length} choix sur les matchs du jour à venir</span>
          <span className="flex gap-1">
            {(["heure", "proba"] as const).map((k) => <button key={k} type="button" onClick={() => setTri(k)} className={`rounded-full border px-2 py-0.5 ${tri === k ? "border-inverse bg-inverse text-on-inverse" : "border-line text-ink-soft"}`}>{k === "heure" ? "Par heure" : "Par %"}</button>)}
          </span>
        </div>
        {liste.length === 0 ? <p className="mt-3 text-[13px] text-ink-soft">Rien dans cette fourchette pour les matchs restants du jour. Élargis-la.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {liste.slice(0, vus).map((o, i, l) => (
              <li key={`${o.matchId}|${o.label}`}>
                {/* Les grands championnats passent d'abord (21/11) : on le dit par un intertitre au lieu de casser l'ordre « Par heure » sans prévenir */}
                {(i === 0 || estTop5(l[i - 1].comp) !== estTop5(o.comp)) && liste.some((x) => estTop5(x.comp)) && liste.some((x) => !estTop5(x.comp)) && (
                  <p className="pb-1 pt-2.5 text-[11px] font-semibold text-ink-muted">{estTop5(o.comp) ? "Grands championnats" : "Autres matchs"}</p>
                )}
                <Link href={`/matchs/${o.matchId}#marches`} className="flex items-center gap-3 py-2">
                  <span className="w-11 shrink-0 text-[12px] tabular-nums text-ink-soft">{heure(o.kickoff)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-snug">{o.label}</span>
                    <span className="block text-[13.5px] font-bold leading-snug text-brand">{o.comp ? `${COMP_FLAG[o.comp] ?? ""} ` : ""}{o.home} – {o.away}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-base font-bold tabular-nums">{Math.round(o.p * 100)} %</span>
                    <span className="block text-[10.5px] text-ink-muted">{o.cote ? `cote ${C(o.cote)}${o.ou && o.ou !== "médiane" ? ` ${o.ou}` : ""}` : "sans cote"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {liste.length > vus && <button type="button" onClick={() => setVus((v) => v + 15)} className="mt-2 h-10 w-full rounded-lg border border-line text-[13px] font-semibold">Afficher plus ({liste.length - vus})</button>}
        <p className="mt-2 text-[11px] text-ink-muted">Probabilités tirées des cotes de référence, marge retirée. Deux choix au plus par match. Une probabilité reste une probabilité : à 75 %, un pari perd encore une fois sur quatre.</p>
      </div>
    </section>
  );
}
