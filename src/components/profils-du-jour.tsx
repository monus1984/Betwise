"use client";

/** Meilleures options du jour, rangées par niveau de risque : Prudent, Équilibré, Audacieux (D15). */
import { useState } from "react";
import { CAT_LABEL, type Categorie } from "@/lib/coach/categories";
import { CarteProposition } from "@/components/proposition";
import type { Proposition } from "@/lib/accueil/load";

const ORDRE: Categorie[] = ["sur", "audacieux", "risque"];
const AIDE: Record<Categorie, string> = {
  sur: "Cotes de 1,10 à 1,29 : les plus probables.",
  audacieux: "Cotes de 1,30 à 1,54 : le compromis entre chance et cote.",
  risque: "Cotes de 1,55 et plus : moins probables, mieux payées.",
};

export function ProfilsDuJour({ profils, titre }: { profils: Record<Categorie, Proposition[]>; titre: string }) {
  const premier = ORDRE.find((k) => k === "audacieux" && profils[k].length) ?? ORDRE.find((k) => profils[k].length) ?? "audacieux";
  const [actif, setActif] = useState<Categorie>(premier);
  const liste = profils[actif];
  return (
    <section aria-label={titre} className="mt-5">
      <h2 className="text-[17px] font-bold">{titre}</h2>
      <div role="tablist" aria-label="Niveau de risque" className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {ORDRE.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={actif === k} onClick={() => setActif(k)}
            className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${actif === k ? "bg-surface text-ink shadow-sm" : "text-ink-muted"}`}>
            {CAT_LABEL[k]} <span className="font-normal text-ink-muted">{profils[k].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-muted">{AIDE[actif]}</p>
      {liste.length ? (
        <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {liste.map((x) => <div key={`${x.matchId}|${x.market}|${x.param}|${x.sel}`} className="w-[84%] shrink-0 snap-start">{<CarteProposition x={x} />}</div>)}
        </div>
      ) : (
        <p className="tile mt-2 p-3 text-[13px] text-ink-soft">Pas de proposition {CAT_LABEL[actif].toLowerCase()} pour l’instant. Les autres niveaux en ont peut-être.</p>
      )}
    </section>
  );
}
