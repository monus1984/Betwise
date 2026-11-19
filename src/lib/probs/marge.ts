/**
 * Retirer la marge du bookmaker d'un jeu de cotes (1, N, 2 ou plus / moins) pour en tirer des probabilités.
 * - proportionnelle : chaque issue perd la même part de marge. Simple, mais sous-estime les favoris.
 * - puissance : les probabilités brutes sont élevées à une même puissance ; la marge pèse davantage sur les issues
 *   peu probables, ce que font réellement les bookmakers.
 * - shin : même idée, formule de Shin (1993), pensée pour les paris à trois issues.
 * Le choix se fait sur mesure (scripts/mesure-probabilites.ts, tableau « Retrait de la marge »), pas sur réputation.
 */
export type MethodeMarge = "proportionnelle" | "puissance" | "shin";
export const METHODES_MARGE: MethodeMarge[] = ["proportionnelle", "puissance", "shin"];
/** Méthode utilisée par l'application. */
export const METHODE_MARGE: MethodeMarge = "proportionnelle";

export function proportionnelle(cotes: number[]): number[] {
  const inv = cotes.map((c) => 1 / c), tot = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / tot);
}

export function puissance(cotes: number[]): number[] {
  const inv = cotes.map((c) => 1 / c);
  if (inv.reduce((a, b) => a + b, 0) <= 1) return proportionnelle(cotes); // pas de marge à retirer
  let lo = 1, hi = 5;
  for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (inv.reduce((s, x) => s + Math.pow(x, k), 0) > 1) lo = k; else hi = k; }
  const k = (lo + hi) / 2, p = inv.map((x) => Math.pow(x, k)), tot = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / tot);
}

export function shin(cotes: number[]): number[] {
  const inv = cotes.map((c) => 1 / c), b = inv.reduce((a, x) => a + x, 0);
  if (b <= 1) return proportionnelle(cotes);
  const p = (z: number) => inv.map((x) => (Math.sqrt(z * z + (4 * (1 - z) * x * x) / b) - z) / (2 * (1 - z)));
  let lo = 0, hi = 0.6;
  for (let i = 0; i < 60; i++) { const z = (lo + hi) / 2; if (p(z).reduce((a, x) => a + x, 0) > 1) lo = z; else hi = z; }
  const out = p((lo + hi) / 2), tot = out.reduce((a, x) => a + x, 0);
  return out.map((x) => x / tot);
}

export function sansMarge(cotes: number[], methode: MethodeMarge = METHODE_MARGE): number[] {
  return methode === "puissance" ? puissance(cotes) : methode === "shin" ? shin(cotes) : proportionnelle(cotes);
}
