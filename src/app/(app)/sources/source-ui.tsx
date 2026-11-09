export function labelType(t: string) {
  return ({
    perso: "Mes propres choix",
    tipster: "Pronostiqueur",
    page_facebook: "Page Facebook",
    compte_instagram: "Compte Instagram",
    canal_telegram: "Canal Telegram",
    site: "Site de prédictions",
    modele_betwise: "Modèle statistique BETWISE",
  } as Record<string, string>)[t] ?? t;
}

/** Statut d'évaluation : Tendance < 30 pronos, Provisoire 30–99, Évalué ≥ 100. */
export function evalStatus(declares: number) {
  return declares >= 100 ? "Évalué" : declares >= 30 ? "Provisoire" : "Tendance";
}

export function TrendBadge({ regles, gagnes, declares }: { regles: number; gagnes: number; declares: number }) {
  if (declares === 0) return <span className="shrink-0 text-xs text-slate-400">aucun prono</span>;
  if (regles === 0) return <span className="shrink-0 text-xs text-slate-500">{declares} en attente</span>;
  const pct = Math.round((100 * gagnes) / regles);
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-semibold tabular-nums">{gagnes}/{regles}</span>
      <span className="block text-[11px] text-slate-500">{pct} % · {evalStatus(declares)}</span>
    </span>
  );
}
