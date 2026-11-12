/**
 * Catégories de risque BETWISE, fixées avec l'utilisateur et vérifiées sur 4 004 matchs (3 saisons, 5 championnats) :
 *  - Sûr       : cote juste 1,10 à 1,20 (probabilité 83 à 91 %) — 87,9 % de réussite constatée
 *  - Audacieux : cote juste 1,20 à 1,50 (67 à 83 %)              — 76,4 %
 *  - Risqué    : cote juste 1,50 à 1,90 (53 à 67 %)              — 59,1 %
 * Au-delà de 1,90 : « Hors catégorie » ; en deçà de 1,08, gain trop faible pour être proposé.
 */
export type Categorie = "sur" | "audacieux" | "risque";
export const CAT_LABEL: Record<Categorie | "hors", string> = { sur: "Sûr", audacieux: "Audacieux", risque: "Risqué", hors: "Très risqué" };
export const CAT_STYLE: Record<Categorie | "hors", string> = {
  sur: "bg-emerald-50 text-gain border-emerald-200", audacieux: "bg-amber-50 text-draw border-amber-200",
  risque: "bg-red-50 text-loss border-red-200", hors: "bg-ink text-white border-ink",
};
export const CAT_CONSTATE: Record<Categorie, number> = { sur: 0.879, audacieux: 0.764, risque: 0.591 };
/** Probabilité moyenne annoncée par les cotes dans chaque catégorie (même étude). */
export const CAT_ANNONCE: Record<Categorie, number> = { sur: 0.866, audacieux: 0.75, risque: 0.591 };

export function categorieOf(p: number): Categorie | "hors" | null {
  if (p > 0.926) return null;          // cote juste < 1,08 : trop peu de gain
  if (p >= 0.833) return "sur";
  if (p >= 0.667) return "audacieux";
  if (p >= 0.526) return "risque";
  return "hors";
}
/** Classement par la cote quand on n'a pas de probabilité (match non couvert). */
export function categorieFromOdds(cote: number): Categorie | "hors" | null {
  return categorieOf(1 / cote / 1.05);
}

/** Mise conseillée : part de la bankroll actuelle. Risqué seulement sur le budget risque (pris sur les gains). */
export const MISE_PART: Record<Categorie, number> = { sur: 0.08, audacieux: 0.05, risque: 0.03 };
export const PART_GAINS_RISQUABLE = 0.3;
export const MARGE_SUPPOSEE = 0.05; // marge moyenne supposée des bookmakers de l'utilisateur
