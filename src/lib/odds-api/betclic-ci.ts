/**
 * Estimation des cotes Betclic Côte d'Ivoire à partir de Betclic France.
 *
 * Aucun fournisseur ne relève Betclic CI. Mesure du 21/11/2026 : 18 cotes 1X2 sur 6 matchs (Premier League,
 * Ligue 1, Bundesliga), captures Betclic CI de Mounir contre The Odds API (betclic_fr), à moins de 15 minutes d'écart.
 * Betclic CI était toujours au-dessus : médiane +3,3 %, moyenne +3,7 %, écart-type ≈ 2 %, de 0 à +7,4 %.
 * Marges : Betclic CI ≈ 6 %, Betclic France ≈ 10 %.
 *
 * Référence = cote France × 1,033 ; fourchette = × 1,017 à × 1,057 (médiane ± un écart-type, ≈ deux cas sur trois).
 * À recalculer quand les tickets Betclic importés donneront plus de paires. Toujours affichée comme estimation :
 * jamais utilisée pour préremplir un pari ni pour calculer une value.
 */
/** Libellé enregistré dans odds_observations pour les cotes Betclic France (The Odds API, clé betclic_fr). */
export const BETCLIC_FR = "Betclic FR";

export const BETCLIC_CI = { reference: 0.033, bas: 0.017, haut: 0.057, mesure: "21/11/2026", paires: 18, matchs: 6 } as const;

const r2 = (x: number) => Math.round(x * 100) / 100;

export type EstimationCI = { cote: number; bas: number; haut: number };

/** Cote Betclic CI estimée et sa fourchette, ou null si la cote France manque ou n'est pas valable. */
export function estimerBetclicCI(coteFrance: number | null | undefined): EstimationCI | null {
  if (!coteFrance || !Number.isFinite(coteFrance) || coteFrance <= 1) return null;
  return { cote: r2(coteFrance * (1 + BETCLIC_CI.reference)), bas: r2(coteFrance * (1 + BETCLIC_CI.bas)), haut: r2(coteFrance * (1 + BETCLIC_CI.haut)) };
}
