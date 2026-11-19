/**
 * Montantes (19/11). Une montante part d'une mise, vise un objectif en un nombre de paliers ; chaque palier est un
 * pari réel dont la mise vient du gain du palier précédent. Tout est calculé à partir des paris rattachés.
 */
export type Montante = { id: string; nom: string; mise_depart: number; objectif: number; paliers_prevus: number; niveau: string | null; statut: string; created_at: string };
export type Palier = { palier: number; mise: number; cote: number | null; statut: string; gain_net: number | null };
export type Statut = "en_cours" | "atteinte" | "cassee" | "arretee";
export const STATUT_FR: Record<Statut, string> = { en_cours: "En cours", atteinte: "Objectif atteint", cassee: "Cassée", arretee: "Arrêtée" };

export function etat(m: Pick<Montante, "mise_depart" | "objectif" | "paliers_prevus" | "statut">, paliers: Palier[]) {
  const l = [...paliers].filter((p) => p.statut !== "annule").sort((a, b) => a.palier - b.palier);
  let capital = m.mise_depart, perdu = false, gagnes = 0;
  for (const p of l) {
    if (p.statut === "gagne") { capital = p.mise + Number(p.gain_net ?? 0); gagnes++; }
    else if (p.statut === "perdu") perdu = true;
  }
  const enCours = l.find((p) => p.statut === "en_cours") ?? null;
  const statut: Statut = m.statut === "arretee" ? "arretee" : perdu ? "cassee" : capital >= m.objectif ? "atteinte" : "en_cours";
  const restants = Math.max(0, m.paliers_prevus - l.length);
  // Cote à trouver par palier pour atteindre l'objectif avec les paliers restants (réinvestissement complet)
  const coteParPalier = statut === "en_cours" && restants > 0 && !enCours ? Math.pow(m.objectif / capital, 1 / restants) : null;
  // À cotes justes (sans marge du bookmaker), la chance d'aller au bout vaut capital / objectif ; la marge la réduit encore
  const chanceJuste = statut === "en_cours" ? Math.min(1, capital / m.objectif) : null;
  return { paliers: l, capital: perdu ? 0 : capital, gagnes, enCours, statut, restants, coteParPalier, chanceJuste, prochainPalier: l.length + 1 };
}

/** Options qui conviennent au prochain palier : cote proche de celle à trouver, la plus probable d'abord. */
export function pourLePalier<T extends { p: number; cote: number | null }>(options: T[], cible: number, max = 3): T[] {
  return options.filter((o) => o.cote !== null && o.cote >= cible * 0.9 && o.cote <= cible * 1.35).sort((a, b) => b.p - a.p).slice(0, max);
}
