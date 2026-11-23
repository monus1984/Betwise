/**
 * Profils BETWISE, fixés par Mounir le 21/11/2026 sur la cote que voit le parieur :
 *  - Prudent   : cote de 1,10 à 1,29
 *  - Équilibré : cote de 1,30 à 1,54
 *  - Audacieux : cote de 1,55 et plus
 * En deçà de 1,10 : gain trop faible, jamais proposé. Sans cote, on part de la probabilité : cote juste (1 / p)
 * diminuée de la marge moyenne des bookmakers (MARGE_SUPPOSEE), pour rester proche de la cote affichée.
 * (Avant le 21/11 : cote juste 1,10–1,20 / 1,20–1,50 / 1,50–1,90, mesurée sur 4 004 matchs ; ces taux ne valent plus
 * pour les nouvelles bornes et ne sont plus affichés.)
 */
export type Categorie = "sur" | "audacieux" | "risque";
export const CAT_LABEL: Record<Categorie | "hors", string> = { sur: "Prudent", audacieux: "Équilibré", risque: "Audacieux", hors: "Très risqué" };
export const CAT_STYLE: Record<Categorie | "hors", string> = {
  sur: "bg-gain-soft text-gain border-gain/30", audacieux: "bg-draw-soft text-draw-ink border-draw/40",
  risque: "bg-loss-soft text-loss border-loss/30", hors: "bg-inverse text-on-inverse border-inverse",
};
/** Bornes lisibles des profils. */
export const CAT_COTES: Record<Categorie, string> = { sur: "cotes 1,10 à 1,29", audacieux: "cotes 1,30 à 1,54", risque: "cotes 1,55 et plus" };
/** Ancienne étude (bornes d'avant le 21/11) : ne sert plus qu'à la simulation de plan, à refaire sur les nouvelles bornes. */
export const CAT_CONSTATE: Record<Categorie, number> = { sur: 0.879, audacieux: 0.764, risque: 0.591 };
/** Probabilité moyenne annoncée par les cotes dans chaque catégorie (même étude). */
export const CAT_ANNONCE: Record<Categorie, number> = { sur: 0.866, audacieux: 0.75, risque: 0.591 };

/** Bornes de cote des profils (cote vue chez le bookmaker). */
export const BORNES_COTE = { min: 1.1, equilibre: 1.3, audacieux: 1.55 } as const;

/** Profil d'une cote affichée ; null sous 1,10. */
export function categorieFromOdds(cote: number): Categorie | null {
  if (!(cote >= BORNES_COTE.min)) return null;
  if (cote < BORNES_COTE.equilibre) return "sur";
  if (cote < BORNES_COTE.audacieux) return "audacieux";
  return "risque";
}
/** Profil d'une probabilité : par la cote qu'elle donnerait chez un bookmaker (cote juste moins la marge moyenne). */
export function categorieOf(p: number): Categorie | "hors" | null {
  if (!(p > 0)) return null;
  return categorieFromOdds(1 / p / (1 + MARGE_SUPPOSEE));
}

/** Profil d'un choix : par sa cote de référence quand elle existe, sinon par sa probabilité. */
export function profilDe(p: number, cote: number | null | undefined): Categorie | null {
  const c = cote && cote > 1 ? categorieFromOdds(cote) : categorieOf(p);
  return c === "hors" ? null : c;
}

/** Mise conseillée : part de la bankroll actuelle. Audacieux seulement sur le budget risque (pris sur les gains). */
export const MISE_PART: Record<Categorie, number> = { sur: 0.08, audacieux: 0.05, risque: 0.03 };
export const PART_GAINS_RISQUABLE = 0.3;
export const MARGE_SUPPOSEE = 0.05; // marge moyenne supposée des bookmakers de l'utilisateur
