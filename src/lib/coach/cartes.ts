/** Cartes affichées sous une réponse du Coach : un accès direct à l'écran d'où viennent les chiffres cités. */
export type Carte = { titre: string; sous: string; href: string };
type Appel = { nom?: string; sortie?: unknown };

const FIXES: Record<string, Carte> = {
  etat_bankroll: { titre: "Ma bankroll", sous: "Solde par compte, mouvements, comparaison", href: "/bankroll" },
  bilan_paris: { titre: "Bilan détaillé", sous: "Réussite et rendement par type, marché, bookmaker", href: "/bilan" },
  bilan_par_origine: { titre: "Bilan détaillé", sous: "Réussite de tes choix selon leur origine", href: "/bilan" },
  paris_en_cours: { titre: "Mes paris en cours", sous: "Le détail de chaque ticket", href: "/paris" },
  sources_suivies: { titre: "Classement des sources", sous: "Notées sur leurs pronos prouvés", href: "/sources?f=classement" },
  mes_tests: { titre: "Mes tests", sous: "Les choix suivis sans miser", href: "/paris?vue=tests" },
  mon_budget: { titre: "Mon budget de la semaine", sous: "Mises et perte autorisées", href: "/coach?v=outils" },
};

export function cartesDe(appels: Appel[]): Carte[] {
  const out: Carte[] = [], vus = new Set<string>();
  const ajoute = (c: Carte) => { if (!vus.has(c.href) && out.length < 3) { vus.add(c.href); out.push(c); } };
  for (const a of appels) {
    if (a.nom === "analyse_match" && Array.isArray(a.sortie)) {
      for (const m of a.sortie as { match_id?: string; match?: string; competition?: string }[])
        if (m.match_id && m.match) ajoute({ titre: m.match, sous: `${m.competition ?? "Match"} · analyse, stats, marchés, sources`, href: `/matchs/${m.match_id}` });
    } else if (a.nom === "detail_source") {
      const s = a.sortie as { source_id?: string; nom?: string } | null;
      if (s?.source_id) ajoute({ titre: s.nom ?? "Source", sous: "Sa note prouvée et son historique", href: `/sources/${s.source_id}` });
    } else if (a.nom && FIXES[a.nom]) ajoute(FIXES[a.nom]);
  }
  return out;
}
